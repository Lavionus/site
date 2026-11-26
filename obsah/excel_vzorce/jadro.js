/* Jádro výukové stránky Excel – vzorce (window.XLV).
   Malý interpret vzorců tabulkového procesoru: tokenizace, syntaktický strom,
   vyhodnocení se záznamem kroků (jako „Vyhodnotit vzorec“ v Excelu), české
   i anglické názvy funkcí, posun odkazů při kopírování a kontrola úloh.
   Bez DOM – testuje se v node (_test/excel_vzorce_test.js). */
(function (koren) {
'use strict';

/* ---------- chyby ---------- */
class Chyba {
  constructor(kod, proc) { this.kod = kod; this.proc = proc || ''; }
}
const CHYBY = {
  DIV0: { cs: '#DĚLENÍ_NULOU!', en: '#DIV/0!', popis: 'Dělení nulou (nebo prázdnou buňkou).' },
  NA: { cs: '#NENÍ_K_DISPOZICI', en: '#N/A', popis: 'Hledaná hodnota nebyla nalezena.' },
  NAME: { cs: '#NÁZEV?', en: '#NAME?', popis: 'Neznámý název – překlep v názvu funkce nebo text bez uvozovek.' },
  VALUE: { cs: '#HODNOTA!', en: '#VALUE!', popis: 'Špatný typ hodnoty – např. počítání s textem.' },
  REF: { cs: '#ODKAZ!', en: '#REF!', popis: 'Odkaz míří mimo list nebo mimo oblast.' },
  NUM: { cs: '#ČÍSLO!', en: '#NUM!', popis: 'Nesmyslné číslo – např. odmocnina ze záporného čísla.' },
  CIRC: { cs: '#CYKLUS!', en: '#CIRCULAR!', popis: 'Cyklický odkaz – vzorec (i oklikou) odkazuje sám na sebe. Excel ukáže varování a 0.' },
};
const chyba = (kod, proc) => { throw new Chyba(kod, proc); };
const jeChyba = v => v instanceof Chyba;

/* ---------- adresy ---------- */
function sloupecNaCislo(s) { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function cisloNaSloupec(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
const adresa = (r, c) => cisloNaSloupec(c) + r;
function rozeberAdresu(a) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(a).trim());
  return m ? { r: +m[2], c: sloupecNaCislo(m[1]) } : null;
}

/* ---------- čísla a data ---------- */
const DEN_MS = 86400000, NULA_DAT = Date.UTC(1899, 11, 30);
const serialZData = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - NULA_DAT) / DEN_MS);
function datumZeSerialu(n) { const d = new Date(NULA_DAT + Math.floor(n) * DEN_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dt: d.getUTCDay() }; }
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];

function fmtCislo(n, jazyk) {
  if (!isFinite(n)) return jazyk === 'en' ? '#NUM!' : '#ČÍSLO!';
  let s = String(parseFloat(n.toPrecision(15)));
  if (/e/.test(s)) s = parseFloat(n.toPrecision(6)).toExponential().replace('e', 'E');
  return jazyk === 'en' ? s : s.replace('.', ',');
}
function fmtDatum(n) { const d = datumZeSerialu(n); return d.d + '. ' + d.m + '. ' + d.y; }

/* text → číslo (přijme desetinnou čárku i tečku a mezery jako oddělovač tisíců) */
function textNaCislo(t) {
  const s = String(t).trim().replace(/[  ](?=\d{3}(\D|$))/g, '');
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?\s?%?$/.test(s)) return null;
  const pct = s.endsWith('%');
  const n = parseFloat(s.replace('%', '').replace(',', '.'));
  return pct ? n / 100 : n;
}
function textNaDatum(t) {
  const m = /^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*$/.exec(t);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return serialZData(y, mo, d);
}

/* ---------- převody hodnot ---------- */
const jePole = v => !!v && typeof v === 'object' && Array.isArray(v.h);
function skalar(v) {
  if (jePole(v)) { if (v.h.length === 1 && v.h[0].length === 1) return v.h[0][0]; chyba('VALUE', 'na místě jedné hodnoty je celá oblast'); }
  return v;
}
function cislo(v) {
  v = skalar(v);
  if (jeChyba(v)) throw v;
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = textNaCislo(v);
  if (n !== null) return n;
  const d = textNaDatum(v);
  if (d !== null) return d;
  chyba('VALUE', `text "${v}" nejde převést na číslo`);
}
const logikaText = (b, jazyk) => jazyk === 'en' ? (b ? 'TRUE' : 'FALSE') : (b ? 'PRAVDA' : 'NEPRAVDA');
function text(v, jazyk) {
  v = skalar(v);
  if (jeChyba(v)) throw v;
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return logikaText(v, jazyk);
  if (typeof v === 'number') return fmtCislo(v, jazyk);
  return v;
}
function logika(v) {
  v = skalar(v);
  if (jeChyba(v)) throw v;
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const u = v.toUpperCase();
  if (u === 'TRUE' || u === 'PRAVDA') return true;
  if (u === 'FALSE' || u === 'NEPRAVDA') return false;
  chyba('VALUE', `text "${v}" není logická hodnota`);
}

/* všechny hodnoty z argumentů (oblasti rozbalí); u každé ví, zda je z oblasti */
function* hodnoty(args) {
  for (const a of args) {
    if (jePole(a)) { for (const radek of a.h) for (const v of radek) yield { v, zOblasti: true }; }
    else yield { v: a, zOblasti: false };
  }
}
/* čísla pro SUMA/PRŮMĚR…: z oblasti jen čísla, přímé argumenty převést */
function cislaArg(args) {
  const out = [];
  for (const { v, zOblasti } of hodnoty(args)) {
    if (jeChyba(v)) throw v;
    if (zOblasti) { if (typeof v === 'number') out.push(v); }
    else if (v !== null && v !== undefined) out.push(cislo(v));
  }
  return out;
}
const plosne = v => jePole(v) ? v.h.flat() : [v];

/* porovnání jako Excel: čísla < text < logické; text bez ohledu na velikost písmen */
function typRad(v) { return typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : 0; }
function porovnej(a, b) {
  if (a === null || a === undefined) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b === null || b === undefined) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const ta = typRad(a), tb = typRad(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (ta === 1) { const x = a.toLowerCase(), y = b.toLowerCase(); return x === y ? 0 : x.localeCompare(y, 'cs') < 0 ? -1 : 1; }
  if (ta === 2) return a === b ? 0 : a ? 1 : -1;
  return a === b ? 0 : a < b ? -1 : 1;
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function vzorNaRegex(s, cele = true) {
  let r = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '~' && i + 1 < s.length) { r += escRe(s[++i]); continue; }
    r += ch === '*' ? '.*' : ch === '?' ? '.' : escRe(ch);
  }
  return new RegExp(cele ? '^' + r + '$' : r, 'is');
}
/* kritérium COUNTIF/SUMIF: ">5", "<>Praha", "Pra*", 7, "" */
function kriterium(k) {
  k = skalar(k);
  if (jeChyba(k)) throw k;
  if (typeof k === 'number' || typeof k === 'boolean') return v => v !== null && v !== undefined && porovnej(v, k) === 0;
  k = k === null || k === undefined ? '' : String(k);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(k);
  const op = m[1] || '=', zbytek = m[2];
  const n = zbytek === '' ? null : (textNaCislo(zbytek) ?? textNaDatum(zbytek));
  const test = c => op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
  if (n !== null) return v => typeof v === 'number' ? test(porovnej(v, n)) : op === '<>';
  if (zbytek === '') return op === '<>' ? (v => v !== null && v !== undefined && v !== '') : (v => v === null || v === undefined || v === '');
  if (op === '=' || op === '<>') {
    const re = vzorNaRegex(zbytek);
    const shoda = v => v !== null && v !== undefined && re.test(String(v));
    return op === '=' ? shoda : v => !shoda(v);
  }
  return v => typeof v === 'string' && test(porovnej(v, zbytek));
}

/* zaokrouhlení jako Excel (polovina od nuly) */
function zaokr(n, d, smer) {
  const f = Math.pow(10, d);
  const m = Number((Math.abs(n) * f).toPrecision(15));
  const r = smer === 'nahoru' ? Math.ceil(m) : smer === 'dolu' ? Math.floor(m) : Math.round(m);
  return Number((Math.sign(n) * r / f).toPrecision(15));
}

/* formát čísla pro HODNOTA.NA.TEXT (malá podmnožina) */
function formatujText(n, f, jazyk) {
  const fl = f.toLowerCase();
  if (/[dmyr]/.test(fl) && !/[0#]/.test(fl)) {
    const d = datumZeSerialu(n);
    return fl.replace(/dddd|ddd|dd|d|mmmm|mmm|mm|m|yyyy|yy|rrrr|rr/g, t => String(({
      dddd: DNY[d.dt], ddd: DNY[d.dt].slice(0, 2), dd: String(d.d).padStart(2, '0'), d: d.d,
      mmmm: MESICE[d.m - 1], mmm: MESICE[d.m - 1].slice(0, 3), mm: String(d.m).padStart(2, '0'), m: d.m,
      yyyy: d.y, rrrr: d.y, yy: String(d.y).slice(2), rr: String(d.y).slice(2),
    })[t]));
  }
  const pct = f.includes('%');
  if (pct) n *= 100;
  const des = (/[.,]([0#]+)/.exec(f) || [, ''])[1].length;
  const tisice = /#[ ,]##0/.test(f);
  let [cele, zl] = Math.abs(zaokr(n, des)).toFixed(des).split('.');
  if (tisice) cele = cele.replace(/\B(?=(\d{3})+(?!\d))/g, jazyk === 'en' ? ',' : ' ');
  const cis = (n < 0 && zaokr(n, des) !== 0 ? '-' : '') + cele + (zl ? (jazyk === 'en' ? '.' : ',') + zl : '');
  const bez = f.replace('%', '');
  const pred = (/^[^0#]*/.exec(bez) || [''])[0].replace(/"/g, '');
  const za = (/[^0#.,]*$/.exec(bez) || [''])[0].replace(/"/g, '');
  return pred + cis + (pct ? '%' : '') + za;
}

/* ---------- funkce ---------- */
/* def(kategorie, EN, CS, argumenty, popis, implementace, volby)
   argumenty v [] jsou nepovinné, „…“ = může se opakovat */
const FUNKCE = {}, ALIAS = {};
function def(kat, en, cs, args, popis, fn, volby = {}) {
  const min = args.filter(a => !a.startsWith('[') && !a.endsWith('…')).length;
  const max = args.some(a => a.endsWith('…')) ? 255 : args.length;
  FUNKCE[en] = { kat, en, cs, args, popis, fn, min, max, ...volby };
  ALIAS[en] = en; ALIAS[cs.toUpperCase()] = en;
}
const N = v => cislo(v), T = (v, p) => text(v, p.jazyk);
const chybi = v => v === undefined || v === null;

def('Matematika', 'SUM', 'SUMA', ['číslo1', 'číslo2…'], 'Sečte čísla a oblasti.', a => cislaArg(a).reduce((s, x) => s + x, 0),
  { vysvetli: (a, v, p) => `sečte ${cislaArg(a).length} čísel (text a prázdné buňky v oblasti přeskočí) = ${fmtCislo(v, p.jazyk)}` });
def('Statistika', 'AVERAGE', 'PRŮMĚR', ['číslo1', 'číslo2…'], 'Aritmetický průměr – součet děleno počtem čísel.', a => {
  const c = cislaArg(a); if (!c.length) chyba('DIV0', 'není žádné číslo k průměrování'); return c.reduce((s, x) => s + x, 0) / c.length;
}, { vysvetli: (a, v, p) => { const c = cislaArg(a); return `součet ${fmtCislo(c.reduce((s, x) => s + x, 0), p.jazyk)} ÷ počet čísel ${c.length} = ${fmtCislo(v, p.jazyk)}`; } });
def('Statistika', 'MIN', 'MIN', ['číslo1', 'číslo2…'], 'Nejmenší číslo.', a => { const c = cislaArg(a); return c.length ? Math.min(...c) : 0; });
def('Statistika', 'MAX', 'MAX', ['číslo1', 'číslo2…'], 'Největší číslo.', a => { const c = cislaArg(a); return c.length ? Math.max(...c) : 0; });
def('Statistika', 'MEDIAN', 'MEDIAN', ['číslo1', 'číslo2…'], 'Prostřední hodnota seřazených čísel.', a => {
  const c = cislaArg(a).sort((x, y) => x - y); if (!c.length) chyba('NUM'); const k = c.length >> 1; return c.length % 2 ? c[k] : (c[k - 1] + c[k]) / 2;
});
def('Statistika', 'COUNT', 'POČET', ['hodnota1', 'hodnota2…'], 'Spočítá buňky, které obsahují číslo.', a => {
  let n = 0;
  for (const { v, zOblasti } of hodnoty(a)) if (typeof v === 'number' || (!zOblasti && (typeof v === 'boolean' || (typeof v === 'string' && textNaCislo(v) !== null)))) n++;
  return n;
}, { vysvetli: (a, v) => `čísel je ${v} (text a prázdné buňky se nepočítají)` });
def('Statistika', 'COUNTA', 'POČET2', ['hodnota1', 'hodnota2…'], 'Spočítá neprázdné buňky (čísla i text).', a => {
  let n = 0; for (const { v } of hodnoty(a)) if (v !== null && v !== undefined) n++; return n;
}, { vysvetli: (a, v) => `neprázdných hodnot je ${v}` });
def('Statistika', 'COUNTBLANK', 'COUNTBLANK', ['oblast'], 'Spočítá prázdné buňky.', a => plosne(a[0]).filter(v => v === null || v === undefined || v === '').length);
def('Statistika', 'LARGE', 'LARGE', ['pole', 'k'], 'K-tá největší hodnota.', a => {
  const c = cislaArg([a[0]]).sort((x, y) => y - x), k = Math.trunc(N(a[1])); if (k < 1 || k > c.length) chyba('NUM', 'k je mimo počet čísel'); return c[k - 1];
});
def('Statistika', 'SMALL', 'SMALL', ['pole', 'k'], 'K-tá nejmenší hodnota.', a => {
  const c = cislaArg([a[0]]).sort((x, y) => x - y), k = Math.trunc(N(a[1])); if (k < 1 || k > c.length) chyba('NUM', 'k je mimo počet čísel'); return c[k - 1];
});
def('Statistika', 'RANK', 'RANK', ['číslo', 'odkaz', '[pořadí]'], 'Pořadí čísla v seznamu (0 = od největšího, 1 = od nejmenšího).', a => {
  const x = N(a[0]), c = cislaArg([a[1]]), vz = !chybi(a[2]) && N(a[2]) !== 0;
  if (!c.includes(x)) chyba('NA', 'číslo v seznamu není'); return 1 + c.filter(y => vz ? y < x : y > x).length;
});
def('Matematika', 'PRODUCT', 'SOUČIN', ['číslo1', 'číslo2…'], 'Vynásobí všechna čísla.', a => cislaArg(a).reduce((s, x) => s * x, 1));
def('Matematika', 'SUMPRODUCT', 'SOUČIN.SKALÁRNÍ', ['pole1', 'pole2…'], 'Vynásobí odpovídající prvky polí a výsledky sečte.', a => {
  const pole = a.map(plosne); const n = pole[0].length;
  if (pole.some(x => x.length !== n)) chyba('VALUE', 'pole mají různou velikost');
  let s = 0;
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (const x of pole) { const v = x[i]; if (jeChyba(v)) throw v; m *= typeof v === 'number' ? v : typeof v === 'boolean' && pole.length === 1 ? +v : 0; }
    s += m;
  }
  return s;
}, { vysvetli: (a, v, p) => `vynásobí prvky na stejných pozicích a součiny sečte = ${fmtCislo(v, p.jazyk)}` });
def('Matematika', 'ROUND', 'ZAOKROUHLIT', ['číslo', 'počet_číslic'], 'Zaokrouhlí na daný počet desetinných míst (5 nahoru).', a => zaokr(N(a[0]), Math.trunc(N(a[1]))),
  { vysvetli: (a, v, p) => { const d = Math.trunc(N(a[1])); return `zaokrouhlí ${fmtCislo(N(a[0]), p.jazyk)} na ${d > 0 ? d + ' desetinná místa' : d === 0 ? 'celé číslo' : 'desítky/stovky (záporný počet míst)'} = ${fmtCislo(v, p.jazyk)}`; } });
def('Matematika', 'ROUNDUP', 'ROUNDUP', ['číslo', 'počet_číslic'], 'Zaokrouhlí vždy nahoru (od nuly).', a => zaokr(N(a[0]), Math.trunc(N(a[1])), 'nahoru'));
def('Matematika', 'ROUNDDOWN', 'ROUNDDOWN', ['číslo', 'počet_číslic'], 'Zaokrouhlí vždy dolů (k nule) – useknutí.', a => zaokr(N(a[0]), Math.trunc(N(a[1])), 'dolu'));
def('Matematika', 'INT', 'CELÁ.ČÁST', ['číslo'], 'Zaokrouhlí dolů na celé číslo (−2,5 → −3).', a => Math.floor(N(a[0])));
def('Matematika', 'MOD', 'MOD', ['číslo', 'dělitel'], 'Zbytek po dělení.', a => {
  const x = N(a[0]), d = N(a[1]); if (d === 0) chyba('DIV0', 'dělitel je 0'); return Number((x - d * Math.floor(x / d)).toPrecision(15));
}, { vysvetli: (a, v, p) => `${fmtCislo(N(a[0]), p.jazyk)} ÷ ${fmtCislo(N(a[1]), p.jazyk)} = ${Math.floor(N(a[0]) / N(a[1]))} celých, zbytek ${fmtCislo(v, p.jazyk)}` });
def('Matematika', 'ABS', 'ABS', ['číslo'], 'Absolutní hodnota (bez znaménka).', a => Math.abs(N(a[0])));
def('Matematika', 'SQRT', 'ODMOCNINA', ['číslo'], 'Druhá odmocnina.', a => { const x = N(a[0]); if (x < 0) chyba('NUM', 'odmocnina ze záporného čísla'); return Math.sqrt(x); });
def('Matematika', 'POWER', 'POWER', ['číslo', 'mocnina'], 'Umocní číslo (totéž co ^).', a => Math.pow(N(a[0]), N(a[1])));

/* logické – KDYŽ, IFS, IFERROR a IFNA vyhodnocuje líně přímo vyhodnocovač */
def('Logické', 'IF', 'KDYŽ', ['podmínka', '[hodnota_ano]', '[hodnota_ne]'], 'Když platí podmínka, vrátí první hodnotu, jinak druhou.', null);
def('Logické', 'IFS', 'IFS', ['podmínka1', 'hodnota1', 'podmínka2…', 'hodnota2…'], 'Postupně zkouší podmínky, vrátí hodnotu u první pravdivé.', null);
def('Logické', 'IFERROR', 'IFERROR', ['hodnota', 'hodnota_při_chybě'], 'Když je výsledek chyba, vrátí náhradní hodnotu.', null);
def('Logické', 'IFNA', 'IFNA', ['hodnota', 'hodnota_při_NA'], 'Náhrada jen pro chybu #NENÍ_K_DISPOZICI.', null);
function logArgs(a) {
  const out = [];
  for (const { v, zOblasti } of hodnoty(a)) {
    if (jeChyba(v)) throw v;
    if (zOblasti) { if (typeof v === 'number' || typeof v === 'boolean') out.push(logika(v)); }
    else out.push(logika(v));
  }
  if (!out.length) chyba('VALUE', 'žádná logická hodnota');
  return out;
}
def('Logické', 'AND', 'A', ['logická1', 'logická2…'], 'PRAVDA, jen když platí všechny podmínky.', a => logArgs(a).every(Boolean),
  { vysvetli: (a, v, p) => { const l = logArgs(a); return `platí ${l.filter(Boolean).length} z ${l.length} podmínek → ${logikaText(v, p.jazyk)} (A chce všechny)`; } });
def('Logické', 'OR', 'NEBO', ['logická1', 'logická2…'], 'PRAVDA, když platí aspoň jedna podmínka.', a => logArgs(a).some(Boolean),
  { vysvetli: (a, v, p) => { const l = logArgs(a); return `platí ${l.filter(Boolean).length} z ${l.length} podmínek → ${logikaText(v, p.jazyk)} (NEBO stačí jedna)`; } });
def('Logické', 'NOT', 'NE', ['logická'], 'Obrátí PRAVDA ↔ NEPRAVDA.', a => !logika(a[0]));
def('Logické', 'CHOOSE', 'ZVOLIT', ['index', 'hodnota1', 'hodnota2…'], 'Vybere hodnotu podle pořadového čísla.', a => {
  const i = Math.trunc(N(a[0])); if (i < 1 || i >= a.length) chyba('VALUE', 'index je mimo seznam hodnot'); return chybi(a[i]) ? 0 : a[i];
});

/* podmíněné počítání */
function dvojice(a, od) {
  const pary = [];
  for (let i = od; i < a.length; i += 2) {
    if (!jePole(a[i])) chyba('VALUE', 'oblast kritéria musí být oblast buněk');
    pary.push({ hodn: plosne(a[i]), test: kriterium(a[i + 1]) });
  }
  const n = pary[0].hodn.length;
  if (pary.some(x => x.hodn.length !== n)) chyba('VALUE', 'oblasti kritérií mají různou velikost');
  return { n, plati: i => pary.every(x => x.test(x.hodn[i])) };
}
const popisKrit = (k, p) => typeof k === 'string' ? `"${k}"` : text(k, p.jazyk);
def('Podmíněné', 'COUNTIF', 'COUNTIF', ['oblast', 'kritérium'], 'Spočítá buňky, které splňují podmínku.', a => {
  if (!jePole(a[0])) chyba('VALUE', 'první argument musí být oblast'); return plosne(a[0]).filter(kriterium(a[1])).length;
}, { vysvetli: (a, v, p) => `projde ${plosne(a[0]).length} buněk, podmínku ${popisKrit(skalar(a[1]), p)} splňuje ${v}` });
def('Podmíněné', 'SUMIF', 'SUMIF', ['oblast', 'kritérium', '[součet]'], 'Sečte hodnoty v řádcích, které splňují podmínku.', a => {
  if (!jePole(a[0])) chyba('VALUE', 'první argument musí být oblast');
  const t = kriterium(a[1]), h = plosne(a[0]), s = plosne(chybi(a[2]) ? a[0] : a[2]);
  let x = 0; h.forEach((v, i) => { if (t(v) && typeof s[i] === 'number') x += s[i]; }); return x;
}, { vysvetli: (a, v, p) => `podmínku ${popisKrit(skalar(a[1]), p)} splňuje ${plosne(a[0]).filter(kriterium(a[1])).length} řádků, součet jejich hodnot = ${fmtCislo(v, p.jazyk)}` });
def('Podmíněné', 'AVERAGEIF', 'AVERAGEIF', ['oblast', 'kritérium', '[průměr]'], 'Průměr hodnot v řádcích, které splňují podmínku.', a => {
  if (!jePole(a[0])) chyba('VALUE', 'první argument musí být oblast');
  const t = kriterium(a[1]), h = plosne(a[0]), s = plosne(chybi(a[2]) ? a[0] : a[2]);
  const c = []; h.forEach((v, i) => { if (t(v) && typeof s[i] === 'number') c.push(s[i]); });
  if (!c.length) chyba('DIV0', 'podmínku nesplňuje žádné číslo'); return c.reduce((x, y) => x + y, 0) / c.length;
});
def('Podmíněné', 'COUNTIFS', 'COUNTIFS', ['oblast1', 'kritérium1', 'oblast2…', 'kritérium2…'], 'Spočítá řádky, které splňují všechny podmínky.', a => {
  const d = dvojice(a, 0); let n = 0; for (let i = 0; i < d.n; i++) if (d.plati(i)) n++; return n;
}, { vysvetli: (a, v) => `všechny ${a.length / 2 | 0} podmínky současně splňuje ${v} řádků` });
def('Podmíněné', 'SUMIFS', 'SUMIFS', ['součet', 'oblast1', 'kritérium1', 'oblast2…', 'kritérium2…'], 'Sečte hodnoty v řádcích, které splňují všechny podmínky.', a => {
  const s = plosne(a[0]), d = dvojice(a, 1); if (s.length !== d.n) chyba('VALUE', 'oblast součtu má jinou velikost');
  let x = 0; for (let i = 0; i < d.n; i++) if (d.plati(i) && typeof s[i] === 'number') x += s[i]; return x;
});

/* vyhledávání */
function oblast(v) { if (!jePole(v)) chyba('VALUE', 'očekává se oblast buněk'); return v; }
function najdi(hledana, seznam, typ) {   /* typ 0 = přesně, 1 = největší ≤, -1 = nejmenší ≥ */
  hledana = skalar(hledana);
  if (jeChyba(hledana)) throw hledana;
  if (typ === 0) {
    const re = typeof hledana === 'string' && /[*?~]/.test(hledana) ? vzorNaRegex(hledana) : null;
    return seznam.findIndex(v => v !== null && v !== undefined && (re ? typeof v === 'string' && re.test(v) : porovnej(v, hledana) === 0));
  }
  let nej = -1;
  seznam.forEach((v, i) => {
    if (v === null || v === undefined || typRad(v) !== typRad(hledana)) return;
    const c = porovnej(v, hledana);
    if (typ === 1 ? c <= 0 : c >= 0) nej = i;
  });
  return nej;
}
const pribliz = a => chybi(a) ? true : logika(a);
def('Vyhledávání', 'VLOOKUP', 'SVYHLEDAT', ['hledat', 'tabulka', 'sloupec', '[přibližně]'], 'Najde hodnotu v 1. sloupci tabulky a vrátí hodnotu ze zvoleného sloupce téhož řádku.', a => {
  const t = oblast(a[1]), s = Math.trunc(N(a[2]));
  if (s < 1) chyba('VALUE', 'číslo sloupce musí být aspoň 1');
  if (s > t.h[0].length) chyba('REF', `tabulka má jen ${t.h[0].length} sloupců`);
  const i = najdi(a[0], t.h.map(r => r[0]), pribliz(a[3]) ? 1 : 0);
  if (i < 0) chyba('NA', 'hledaná hodnota v 1. sloupci tabulky není');
  return t.h[i][s - 1];
}, { vysvetli: (a, v, p) => {
  const pr = pribliz(a[3]), i = najdi(a[0], a[1].h.map(r => r[0]), pr ? 1 : 0);
  return `hledá ${literal(skalar(a[0]), p.jazyk)} v 1. sloupci ${pr ? '(PŘIBLIŽNĚ – největší menší nebo rovná, data musí být seřazená vzestupně)' : '(PŘESNĚ)'} → ${i + 1}. řádek tabulky, z ${Math.trunc(N(a[2]))}. sloupce vrací ${literal(v, p.jazyk)}`;
} });
def('Vyhledávání', 'HLOOKUP', 'VVYHLEDAT', ['hledat', 'tabulka', 'řádek', '[přibližně]'], 'Jako SVYHLEDAT, ale hledá v 1. řádku a vrací ze zvoleného řádku.', a => {
  const t = oblast(a[1]), s = Math.trunc(N(a[2]));
  if (s < 1) chyba('VALUE'); if (s > t.h.length) chyba('REF', `tabulka má jen ${t.h.length} řádků`);
  const i = najdi(a[0], t.h[0], pribliz(a[3]) ? 1 : 0); if (i < 0) chyba('NA', 'hledaná hodnota v 1. řádku není');
  return t.h[s - 1][i];
});
def('Vyhledávání', 'MATCH', 'POZVYHLEDAT', ['hledat', 'prohledat', '[shoda]'], 'Vrátí pořadí (pozici) hledané hodnoty v řádku nebo sloupci.', a => {
  const t = oblast(a[1]); if (t.h.length > 1 && t.h[0].length > 1) chyba('NA', 'prohledává se jen jeden řádek nebo sloupec');
  const typ = chybi(a[2]) ? 1 : Math.sign(N(a[2]));
  const i = najdi(a[0], t.h.flat(), typ); if (i < 0) chyba('NA', 'hodnota nenalezena'); return i + 1;
}, { vysvetli: (a, v, p) => `${literal(skalar(a[0]), p.jazyk)} je na ${v}. místě prohledávané oblasti` });
def('Vyhledávání', 'INDEX', 'INDEX', ['pole', 'řádek', '[sloupec]'], 'Vrátí hodnotu na zadaném řádku a sloupci oblasti.', a => {
  const t = oblast(a[0]); let r = Math.trunc(N(a[1])), c = chybi(a[2]) ? 0 : Math.trunc(N(a[2]));
  if (chybi(a[2]) && t.h.length === 1) { c = r; r = 1; }
  if (c === 0) c = 1;
  if (r < 1 || c < 1 || r > t.h.length || c > t.h[0].length) chyba('REF', 'řádek nebo sloupec je mimo oblast');
  return t.h[r - 1][c - 1];
}, { vysvetli: (a, v, p) => `z oblasti vezme ${Math.trunc(N(a[1]))}. ${a[0].h.length === 1 ? 'položku' : 'řádek'}${chybi(a[2]) ? '' : ', ' + Math.trunc(N(a[2])) + '. sloupec'} → ${literal(v, p.jazyk)}` });
def('Vyhledávání', 'XLOOKUP', 'XLOOKUP', ['hledat', 'prohledat', 'vrátit', '[když_nenalezeno]', '[režim_shody]', '[režim_hledání]'], 'Najde hodnotu v jedné oblasti a vrátí hodnotu ze stejné pozice druhé oblasti (Excel 2021/365).', a => {
  const hl = plosne(oblast(a[1])), vr = plosne(oblast(a[2]));
  if (hl.length !== vr.length) chyba('VALUE', 'oblasti prohledat a vrátit mají různou délku');
  const rezim = chybi(a[4]) ? 0 : Math.trunc(N(a[4]));
  const poradi = hl.map((v, i) => i); if (!chybi(a[5]) && N(a[5]) < 0) poradi.reverse();
  const h = skalar(a[0]); if (jeChyba(h)) throw h;
  const re = rezim === 2 && typeof h === 'string' ? vzorNaRegex(h) : null;
  let nalez = poradi.find(i => { const v = hl[i]; return v !== null && v !== undefined && (re ? typeof v === 'string' && re.test(v) : porovnej(v, h) === 0); });
  if (nalez === undefined && (rezim === -1 || rezim === 1)) {
    for (const i of poradi) {
      const v = hl[i]; if (v === null || v === undefined || typRad(v) !== typRad(h)) continue;
      const c = porovnej(v, h);
      if ((rezim === -1 ? c < 0 : c > 0) && (nalez === undefined || (rezim === -1 ? porovnej(v, hl[nalez]) > 0 : porovnej(v, hl[nalez]) < 0))) nalez = i;
    }
  }
  if (nalez === undefined) { if (!chybi(a[3])) return skalar(a[3]); chyba('NA', 'hodnota nenalezena'); }
  return vr[nalez];
}, { vysvetli: (a, v, p) => `najde ${literal(skalar(a[0]), p.jazyk)} v prohledávané oblasti a vrátí hodnotu ze stejné pozice oblasti vrátit → ${literal(v, p.jazyk)}` });

/* text */
def('Text', 'LEFT', 'ZLEVA', ['text', '[počet_znaků]'], 'Prvních N znaků zleva.', (a, p) => { const n = chybi(a[1]) ? 1 : N(a[1]); if (n < 0) chyba('VALUE'); return T(a[0], p).slice(0, n); });
def('Text', 'RIGHT', 'ZPRAVA', ['text', '[počet_znaků]'], 'Posledních N znaků zprava.', (a, p) => { const n = chybi(a[1]) ? 1 : N(a[1]); if (n < 0) chyba('VALUE'); return n === 0 ? '' : T(a[0], p).slice(-n); });
def('Text', 'MID', 'ČÁST', ['text', 'start', 'počet_znaků'], 'Část textu od pozice start (první znak = 1).', (a, p) => {
  const s = Math.trunc(N(a[1])), n = Math.trunc(N(a[2])); if (s < 1 || n < 0) chyba('VALUE', 'start musí být aspoň 1'); return T(a[0], p).substr(s - 1, n);
}, { vysvetli: (a, v, p) => `od ${Math.trunc(N(a[1]))}. znaku vezme ${Math.trunc(N(a[2]))} znaků → ${literal(v, p.jazyk)}` });
def('Text', 'LEN', 'DÉLKA', ['text'], 'Počet znaků (i mezer).', (a, p) => T(a[0], p).length);
def('Text', 'UPPER', 'VELKÁ', ['text'], 'Převede na VELKÁ písmena.', (a, p) => T(a[0], p).toLocaleUpperCase('cs'));
def('Text', 'LOWER', 'MALÁ', ['text'], 'Převede na malá písmena.', (a, p) => T(a[0], p).toLocaleLowerCase('cs'));
def('Text', 'PROPER', 'VELKÁ2', ['text'], 'Každé Slovo S Velkým Písmenem.', (a, p) => T(a[0], p).toLocaleLowerCase('cs').replace(/(^|[^\p{L}])(\p{L})/gu, (m, x, y) => x + y.toLocaleUpperCase('cs')));
def('Text', 'TRIM', 'PROČISTIT', ['text'], 'Odstraní mezery na začátku, na konci a zdvojené mezery uvnitř.', (a, p) => T(a[0], p).replace(/ +/g, ' ').trim());
def('Text', 'CONCAT', 'CONCAT', ['text1', 'text2…'], 'Spojí texty (i z oblastí) – totéž co &.', (a, p) => { let s = ''; for (const { v } of hodnoty(a)) s += text(v, p.jazyk); return s; });
def('Text', 'CONCATENATE', 'CONCATENATE', ['text1', 'text2…'], 'Spojí texty (starší funkce, oblasti neumí).', (a, p) => a.map(x => T(x, p)).join(''));
def('Text', 'TEXTJOIN', 'TEXTJOIN', ['oddělovač', 'ignorovat_prázdné', 'text1', 'text2…'], 'Spojí texty a vloží mezi ně oddělovač.', (a, p) => {
  const odd = T(a[0], p), ign = logika(a[1]); const c = [];
  for (const { v } of hodnoty(a.slice(2))) { const t = text(v, p.jazyk); if (!(ign && t === '')) c.push(t); }
  return c.join(odd);
});
def('Text', 'FIND', 'NAJÍT', ['co', 'kde', '[start]'], 'Pozice textu v textu (rozlišuje velká a malá písmena).', (a, p) => {
  const s = chybi(a[2]) ? 1 : Math.trunc(N(a[2])), i = T(a[1], p).indexOf(T(a[0], p), s - 1); if (i < 0) chyba('VALUE', 'hledaný text tam není'); return i + 1;
}, { vysvetli: (a, v, p) => `"${T(a[0], p)}" začíná na ${v}. znaku textu "${T(a[1], p)}"` });
def('Text', 'SEARCH', 'HLEDAT', ['co', 'kde', '[start]'], 'Pozice textu v textu (nerozlišuje velikost písmen, umí * a ?).', (a, p) => {
  const s = chybi(a[2]) ? 1 : Math.trunc(N(a[2])), m = vzorNaRegex(T(a[0], p), false).exec(T(a[1], p).slice(s - 1));
  if (!m) chyba('VALUE', 'hledaný text tam není'); return m.index + s;
});
def('Text', 'SUBSTITUTE', 'DOSADIT', ['text', 'starý', 'nový', '[výskyt]'], 'Nahradí v textu jeden text jiným.', (a, p) => {
  const t = T(a[0], p), st = T(a[1], p), no = T(a[2], p); if (!st) return t;
  if (chybi(a[3])) return t.split(st).join(no);
  const k = Math.trunc(N(a[3])); let i = -1;
  for (let j = 0; j < k; j++) { i = t.indexOf(st, i + 1); if (i < 0) return t; }
  return t.slice(0, i) + no + t.slice(i + st.length);
});
def('Text', 'REPT', 'OPAKOVAT', ['text', 'počet'], 'Zopakuje text N-krát (třeba jako jednoduchý graf ■■■).', (a, p) => { const n = Math.trunc(N(a[1])); if (n < 0) chyba('VALUE'); return T(a[0], p).repeat(Math.min(n, 500)); });
def('Text', 'VALUE', 'HODNOTA', ['text'], 'Převede text, který vypadá jako číslo, na číslo.', a => N(a[0]));
def('Text', 'TEXT', 'HODNOTA.NA.TEXT', ['hodnota', 'formát'], 'Převede číslo na text v daném formátu („0,00“, „d.m.yyyy“, „mmmm“…).', (a, p) => formatujText(N(a[0]), T(a[1], p), p.jazyk));

/* informační (chyby v argumentu nevadí) */
def('Informační', 'ISBLANK', 'JE.PRÁZDNÉ', ['hodnota'], 'PRAVDA, když je buňka prázdná.', a => chybi(skalar(a[0])));
def('Informační', 'ISNUMBER', 'JE.ČISLO', ['hodnota'], 'PRAVDA, když je hodnota číslo.', a => typeof skalar(a[0]) === 'number');
def('Informační', 'ISTEXT', 'JE.TEXT', ['hodnota'], 'PRAVDA, když je hodnota text.', a => typeof skalar(a[0]) === 'string');
def('Informační', 'ISERROR', 'JE.CHYBA', ['hodnota'], 'PRAVDA, když je hodnota chyba.', a => { try { return jeChyba(skalar(a[0])); } catch (e) { return true; } });

/* datum */
def('Datum', 'TODAY', 'DNES', [], 'Dnešní datum (pořadové číslo dne).', () => { const d = new Date(); return serialZData(d.getFullYear(), d.getMonth() + 1, d.getDate()); }, { datum: true });
def('Datum', 'DATE', 'DATUM', ['rok', 'měsíc', 'den'], 'Složí datum z roku, měsíce a dne (přetečení dopočítá: 32. 1. = 1. 2.).', a =>
  Math.round((Date.UTC(Math.trunc(N(a[0])), Math.trunc(N(a[1])) - 1, Math.trunc(N(a[2]))) - NULA_DAT) / DEN_MS),
{ datum: true, vysvetli: (a, v) => `${fmtDatum(v)} je ${v}. den od začátku roku 1900 – Excel ukládá datum jako číslo` });
def('Datum', 'YEAR', 'ROK', ['datum'], 'Rok z data.', a => datumZeSerialu(N(a[0])).y);
def('Datum', 'MONTH', 'MĚSÍC', ['datum'], 'Měsíc z data (1–12).', a => datumZeSerialu(N(a[0])).m);
def('Datum', 'DAY', 'DEN', ['datum'], 'Den v měsíci z data (1–31).', a => datumZeSerialu(N(a[0])).d);
def('Datum', 'WEEKDAY', 'DENTÝDNE', ['datum', '[typ]'], 'Den v týdnu: typ 1 = neděle 1 … sobota 7, typ 2 = pondělí 1 … neděle 7.', a => {
  const dt = datumZeSerialu(N(a[0])).dt, typ = chybi(a[1]) ? 1 : Math.trunc(N(a[1]));
  return typ === 2 ? (dt + 6) % 7 + 1 : typ === 3 ? (dt + 6) % 7 : dt + 1;
}, { vysvetli: (a, v) => `${fmtDatum(N(a[0]))} je ${DNY[datumZeSerialu(N(a[0])).dt]} → ${v}` });
def('Datum', 'EOMONTH', 'EOMONTH', ['datum', 'měsíce'], 'Poslední den měsíce posunutého o N měsíců.', a => {
  const d = datumZeSerialu(N(a[0])); return Math.round((Date.UTC(d.y, d.m + Math.trunc(N(a[1])), 0) - NULA_DAT) / DEN_MS);
}, { datum: true });
def('Datum', 'NETWORKDAYS', 'NETWORKDAYS', ['začátek', 'konec'], 'Počet pracovních dnů (po–pá) mezi daty včetně obou.', a => {
  let z = Math.floor(N(a[0])), k = Math.floor(N(a[1])), zn = 1; if (z > k) { [z, k] = [k, z]; zn = -1; }
  let n = 0; for (let x = z; x <= k && n < 100000; x++) { const dt = datumZeSerialu(x).dt; if (dt !== 0 && dt !== 6) n++; } return n * zn;
});

const nazevFunkce = (en, jazyk) => jazyk === 'en' ? en : FUNKCE[en].cs;
const oddelovac = jazyk => jazyk === 'en' ? ',' : ';';

/* ---------- tokenizace ---------- */
function chybaSyntaxe(zprava, pozice) { const e = new Error(zprava); e.syntaxe = true; e.pozice = pozice; return e; }
const PISMENO = /[A-Za-zÀ-ž_]/;
function tokenizuj(s, jazyk = 'cs', tolerantne = false) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const z = i;
    if (ch === '"') {
      let v = ''; i++;
      while (i < s.length) { if (s[i] === '"') { if (s[i + 1] === '"') { v += '"'; i += 2; continue; } break; } v += s[i++]; }
      if (i >= s.length) { if (!tolerantne) throw chybaSyntaxe('Chybí uzavírací uvozovka "', z); t.push({ t: 'str', v, s: z, e: i }); break; }
      i++; t.push({ t: 'str', v, s: z, e: i }); continue;
    }
    if (ch === '#') {
      const m = /^#(DIV\/0!|N\/A|NAME\?|VALUE!|REF!|NUM!|DĚLENÍ_NULOU!|NENÍ_K_DISPOZICI|NÁZEV\?|HODNOTA!|ODKAZ!|ČÍSLO!)/i.exec(s.slice(i));
      if (!m) throw chybaSyntaxe('Neznámá chybová hodnota', z);
      const u = m[0].toUpperCase();
      i += m[0].length; t.push({ t: 'err', v: Object.keys(CHYBY).find(k => CHYBY[k].cs === u || CHYBY[k].en === u), s: z, e: i }); continue;
    }
    if (/\d/.test(ch) || ((ch === '.' || (ch === ',' && jazyk !== 'en')) && /\d/.test(s[i + 1] || ''))) {
      const m = (jazyk === 'en' ? /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/ : /^(\d+([,.]\d*)?|[,.]\d+)([eE][+-]?\d+)?/).exec(s.slice(i));
      i += m[0].length; t.push({ t: 'num', v: parseFloat(m[0].replace(',', '.')), s: z, e: i }); continue;
    }
    if (ch === '$' || PISMENO.test(ch)) {
      const slovo = /^[$A-Za-zÀ-ž_][\wÀ-ž.$]*/.exec(s.slice(i))[0];
      i += slovo.length;
      let j = i; while (s[j] === ' ') j++;
      const ref = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(slovo);
      if (s[j] === '(' && !slovo.includes('$')) { t.push({ t: 'fn', v: slovo.toUpperCase(), s: z, e: i }); continue; }
      if (ref && +ref[4] > 0 && sloupecNaCislo(ref[2]) <= 16384) {
        t.push({ t: 'ref', s: z, e: i, c: sloupecNaCislo(ref[2]), r: +ref[4], absC: !!ref[1], absR: !!ref[3] }); continue;
      }
      t.push({ t: 'name', v: slovo.toUpperCase(), text: slovo, s: z, e: i }); continue;
    }
    const dvoj = s.slice(i, i + 2);
    if (dvoj === '<=' || dvoj === '>=' || dvoj === '<>') { i += 2; t.push({ t: 'op', v: dvoj, s: z, e: i }); continue; }
    if ('+-*/^&=<>%:'.includes(ch)) { i++; t.push({ t: 'op', v: ch, s: z, e: i }); continue; }
    if (ch === '(') { i++; t.push({ t: 'lp', s: z, e: i }); continue; }
    if (ch === ')') { i++; t.push({ t: 'rp', s: z, e: i }); continue; }
    if (ch === ';' || (ch === ',' && jazyk === 'en')) { i++; t.push({ t: 'sep', s: z, e: i }); continue; }
    if (ch === ',') throw chybaSyntaxe('V českém Excelu se argumenty oddělují středníkem ; (čárka je desetinná)', z);
    throw chybaSyntaxe(`Neočekávaný znak „${ch}“`, z);
  }
  return t;
}

/* ---------- parser ---------- */
/* priority jako v Excelu: : > záporné znaménko > % > ^ > * / > + - > & > porovnání */
const PRIORITA = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
function rozeber(vstup, jazyk = 'cs') {
  let src = String(vstup), posun = 0;
  if (src.startsWith('=')) { src = src.slice(1); posun = 1; }
  let tok;
  try { tok = tokenizuj(src, jazyk); } catch (e) { e.pozice += posun; throw e; }
  tok = tok.map(x => ({ ...x, s: x.s + posun, e: x.e + posun }));
  let i = 0;
  const kon = () => tok[i], dalsi = () => tok[i++];
  const konec = () => (tok.length ? tok[tok.length - 1].e : posun);
  const ref = k => ({ t: 'ref', r: k.r, c: k.c, absR: k.absR, absC: k.absC, s: k.s, e: k.e });

  function vyraz(minPr) {
    let l = unarni();
    while (kon() && kon().t === 'op' && PRIORITA[kon().v] >= minPr) {
      const op = dalsi();
      if (!kon()) throw chybaSyntaxe(`Za operátorem ${op.v} chybí hodnota`, op.e);
      const r = vyraz(PRIORITA[op.v] + 1);
      l = { t: 'op', op: op.v, l, r, s: l.s, e: r.e };
    }
    return l;
  }
  function unarni() {
    const k = kon();
    if (k && k.t === 'op' && (k.v === '-' || k.v === '+')) {
      dalsi();
      if (!kon()) throw chybaSyntaxe(`Za znaménkem ${k.v} chybí hodnota`, k.e);
      const x = unarni();
      return { t: 'un', op: k.v, x, s: k.s, e: x.e };
    }
    let x = atom();
    while (kon() && kon().t === 'op' && kon().v === '%') { const p = dalsi(); x = { t: 'pct', x, s: x.s, e: p.e }; }
    return x;
  }
  function atom() {
    const k = dalsi();
    if (!k) throw chybaSyntaxe('Vzorec je neúplný – chybí hodnota', konec());
    switch (k.t) {
      case 'num': case 'str': case 'err': return { t: k.t, v: k.v, s: k.s, e: k.e };
      case 'ref': {
        if (kon() && kon().t === 'op' && kon().v === ':') {
          dalsi();
          const b = dalsi();
          if (!b || b.t !== 'ref') throw chybaSyntaxe('Za dvojtečkou musí být adresa buňky (např. A1:A5)', b ? b.s : konec());
          return { t: 'range', a: ref(k), b: ref(b), s: k.s, e: b.e };
        }
        return ref(k);
      }
      case 'name':
        if (k.v === 'TRUE' || k.v === 'PRAVDA') return { t: 'bool', v: true, s: k.s, e: k.e };
        if (k.v === 'FALSE' || k.v === 'NEPRAVDA') return { t: 'bool', v: false, s: k.s, e: k.e };
        return { t: 'jmeno', v: k.text, s: k.s, e: k.e };
      case 'fn': {
        dalsi(); /* ( */
        const args = [], en = ALIAS[k.v] || null;
        if (kon() && kon().t === 'rp') { const p = dalsi(); return { t: 'fn', en, jmeno: k.v, args, s: k.s, e: p.e }; }
        for (;;) {
          if (kon() && (kon().t === 'sep' || kon().t === 'rp')) args.push({ t: 'prazdny', s: kon().s, e: kon().s });
          else args.push(vyraz(1));
          const z = dalsi();
          if (!z) throw chybaSyntaxe(`Chybí uzavírací závorka funkce ${k.v}`, konec());
          if (z.t === 'rp') return { t: 'fn', en, jmeno: k.v, args, s: k.s, e: z.e };
          if (z.t !== 'sep') throw chybaSyntaxe(`Mezi argumenty chybí oddělovač ${oddelovac(jazyk)}`, z.s);
        }
      }
      case 'lp': {
        const x = vyraz(1), z = dalsi();
        if (!z || z.t !== 'rp') throw chybaSyntaxe('Chybí uzavírací závorka )', z ? z.s : konec());
        return { t: 'zav', x, s: k.s, e: z.e };
      }
      case 'rp': throw chybaSyntaxe('Přebytečná uzavírací závorka )', k.s);
      case 'sep': throw chybaSyntaxe('Oddělovač argumentů mimo funkci', k.s);
      default: throw chybaSyntaxe(`Na tomto místě nečekám „${k.v}“`, k.s);
    }
  }
  if (!tok.length) throw chybaSyntaxe('Prázdný vzorec', posun);
  const strom = vyraz(1);
  if (i < tok.length) {
    const k = tok[i];
    throw chybaSyntaxe(k.t === 'rp' ? 'Přebytečná uzavírací závorka )' : 'Tady chybí operátor (+ − * / & …) nebo středník', k.s);
  }
  return strom;
}

/* ---------- vykreslení stromu zpět na text ---------- */
function literal(v, jazyk) {
  if (v === null || v === undefined) return '0';
  if (jeChyba(v)) return CHYBY[v.kod][jazyk === 'en' ? 'en' : 'cs'];
  if (typeof v === 'number') return fmtCislo(v, jazyk);
  if (typeof v === 'boolean') return logikaText(v, jazyk);
  if (typeof v === 'string') return '"' + v.replace(/"/g, '""') + '"';
  if (jePole(v)) {
    const odd = oddelovac(jazyk);
    const radky = v.h.map(r => r.map(x => x === null || x === undefined ? '∅' : literal(x, jazyk)));
    const vektor = v.h.length === 1 || v.h[0].length === 1;
    const prvky = vektor ? radky.flat() : radky.map(r => r.join(odd));
    const spoj = vektor ? odd : ' | ';
    return '{' + (prvky.length > 12 ? prvky.slice(0, 10).join(spoj) + spoj + '…' : prvky.join(spoj)) + '}';
  }
  return String(v);
}
const textRef = n => (n.absC ? '$' : '') + cisloNaSloupec(n.c) + (n.absR ? '$' : '') + n.r;
/* o: { jazyk, hodnoty: Map(uzel → hodnota) už vyhodnocených částí, obal(uzel, html, jeHodnota), esc } */
function vykresli(uzel, o = {}) {
  const jazyk = o.jazyk || 'cs', esc = o.esc || (x => x), obal = o.obal || ((u, x) => x), hod = o.hodnoty;
  function r(u) {
    if (hod && hod.has(u)) return obal(u, esc(literal(hod.get(u), jazyk)), true);
    let x = '';
    switch (u.t) {
      case 'num': x = esc(fmtCislo(u.v, jazyk)); break;
      case 'str': x = esc('"' + u.v.replace(/"/g, '""') + '"'); break;
      case 'bool': x = esc(logikaText(u.v, jazyk)); break;
      case 'err': x = esc(CHYBY[u.v][jazyk === 'en' ? 'en' : 'cs']); break;
      case 'ref': x = esc(textRef(u)); break;
      case 'range': x = esc(textRef(u.a) + ':' + textRef(u.b)); break;
      case 'jmeno': x = esc(u.v); break;
      case 'zav': x = esc('(') + r(u.x) + esc(')'); break;
      case 'un': x = esc(u.op) + r(u.x); break;
      case 'pct': x = r(u.x) + esc('%'); break;
      case 'op': x = r(u.l) + esc(u.op) + r(u.r); break;
      case 'fn': x = esc((u.en ? nazevFunkce(u.en, jazyk) : u.jmeno) + '(') + u.args.map(r).join(esc(oddelovac(jazyk))) + esc(')'); break;
    }
    return obal(u, x, false);
  }
  return r(uzel);
}

/* ---------- posun odkazů při kopírování ---------- */
function posunStrom(uzel, dr, dc) {
  const p = n => {
    const r = n.absR ? n.r : n.r + dr, c = n.absC ? n.c : n.c + dc;
    return r < 1 || c < 1 ? null : { ...n, r, c };
  };
  function k(u) {
    switch (u.t) {
      case 'ref': return p(u) || { t: 'err', v: 'REF', s: u.s, e: u.e };
      case 'range': { const a = p(u.a), b = p(u.b); return a && b ? { ...u, a, b } : { t: 'err', v: 'REF', s: u.s, e: u.e }; }
      case 'zav': case 'un': case 'pct': return { ...u, x: k(u.x) };
      case 'op': return { ...u, l: k(u.l), r: k(u.r) };
      case 'fn': return { ...u, args: u.args.map(k) };
      default: return { ...u };
    }
  }
  return k(uzel);
}
const posunVzorec = (vzorec, dr, dc, jazyk = 'cs') => '=' + vykresli(posunStrom(rozeber(vzorec, jazyk), dr, dc), { jazyk });
/* převod zápisu mezi češtinou a angličtinou */
function prelozVzorec(vzorec, z, na) {
  if (!String(vzorec).startsWith('=') || z === na) return vzorec;
  try { return '=' + vykresli(rozeber(vzorec, z), { jazyk: na }); } catch (e) { return vzorec; }
}

/* ---------- vyhodnocení ---------- */
function elementove(a, b, f) {
  const A = jePole(a), B = jePole(b);
  if (!A && !B) return f(a, b);
  const ha = A ? a.h : [[a]], hb = B ? b.h : [[b]];
  const R = Math.max(ha.length, hb.length), C = Math.max(ha[0].length, hb[0].length);
  const v = (h, r, c) => (h.length === 1 ? h[0] : h[r])?.[h[0].length === 1 ? 0 : c];
  const out = [];
  for (let r = 0; r < R; r++) {
    const radek = [];
    for (let c = 0; c < C; c++) {
      const x = v(ha, r, c), y = v(hb, r, c);
      if (x === undefined || y === undefined) { radek.push(new Chyba('NA', 'pole mají různou velikost')); continue; }
      try { radek.push(f(x, y)); } catch (e) { if (e instanceof Chyba) radek.push(e); else throw e; }
    }
    out.push(radek);
  }
  return { h: out, pole: true };
}
const NAZVY_OP = { '+': 'sčítání', '-': 'odčítání', '*': 'násobení', '/': 'dělení', '^': 'umocnění', '&': 'spojení textů', '=': 'porovnání „je rovno?“', '<>': 'porovnání „je různé?“', '<': 'porovnání „je menší?“', '>': 'porovnání „je větší?“', '<=': 'porovnání „je menší nebo rovno?“', '>=': 'porovnání „je větší nebo rovno?“' };
function binarni(op, a, b, jazyk) {
  if (jeChyba(a)) throw a;
  if (jeChyba(b)) throw b;
  switch (op) {
    case '+': return cislo(a) + cislo(b);
    case '-': return cislo(a) - cislo(b);
    case '*': return cislo(a) * cislo(b);
    case '/': { const d = cislo(b); if (d === 0) chyba('DIV0', 'dělí se nulou (nebo prázdnou buňkou)'); return cislo(a) / d; }
    case '^': { const x = Math.pow(cislo(a), cislo(b)); if (!isFinite(x)) chyba('NUM'); return x; }
    case '&': return text(a, jazyk) + text(b, jazyk);
    default: {
      const c = porovnej(a, b);
      return op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
    }
  }
}

/* ctx: { bunka(r, c) → hodnota, jazyk, kroky: [] | null } */
function vyhodnotUzel(u, ctx) {
  const krok = (hodnota, popis) => { if (ctx.kroky) ctx.kroky.push({ uzel: u, hodnota, popis }); return hodnota; };
  const zachyt = f => { try { return f(); } catch (e) { if (e instanceof Chyba) return e; throw e; } };
  const L = v => literal(v, ctx.jazyk);
  switch (u.t) {
    case 'num': case 'str': case 'bool': return u.v;
    case 'err': return new Chyba(u.v);
    case 'prazdny': return null;
    case 'jmeno': return krok(new Chyba('NAME'), `„${u.v}“ není funkce, adresa ani PRAVDA/NEPRAVDA. Je-li to text, patří do uvozovek: "${u.v}"`);
    case 'ref': {
      const v = ctx.bunka(u.r, u.c);
      return krok(v, `${textRef(u)} → hodnota buňky ${adresa(u.r, u.c)}${v === null ? ' (prázdná – v počtech se bere jako 0, v textu jako "")' : ''}`);
    }
    case 'range': {
      const r1 = Math.min(u.a.r, u.b.r), r2 = Math.max(u.a.r, u.b.r), c1 = Math.min(u.a.c, u.b.c), c2 = Math.max(u.a.c, u.b.c);
      const h = [];
      for (let r = r1; r <= r2; r++) { const radek = []; for (let c = c1; c <= c2; c++) radek.push(ctx.bunka(r, c)); h.push(radek); }
      return krok({ h, r1, c1, r2, c2 }, `oblast ${adresa(r1, c1)}:${adresa(r2, c2)} → ${r2 - r1 + 1} ${r2 > r1 ? 'řádků' : 'řádek'} × ${c2 - c1 + 1} ${c2 > c1 ? 'sloupců' : 'sloupec'} = ${(r2 - r1 + 1) * (c2 - c1 + 1)} hodnot (∅ = prázdná)`);
    }
    case 'zav': return vyhodnotUzel(u.x, ctx);
    case 'un': {
      const x = vyhodnotUzel(u.x, ctx);
      const v = zachyt(() => elementove(x, 0, a => { if (jeChyba(a)) throw a; return u.op === '-' ? -cislo(a) : cislo(a); }));
      return krok(v, u.op === '-' ? `záporné znaménko: ${L(x)} → ${L(v)}` : 'kladné znaménko nic nemění');
    }
    case 'pct': {
      const x = vyhodnotUzel(u.x, ctx);
      const v = zachyt(() => elementove(x, 0, a => { if (jeChyba(a)) throw a; return cislo(a) / 100; }));
      return krok(v, `procento: ${L(x)} % = ${L(x)} ÷ 100 = ${L(v)}`);
    }
    case 'op': {
      const a = vyhodnotUzel(u.l, ctx), b = vyhodnotUzel(u.r, ctx);
      const v = zachyt(() => elementove(a, b, (x, y) => binarni(u.op, x, y, ctx.jazyk)));
      let popis = `${NAZVY_OP[u.op]}: ${L(a)} ${u.op} ${L(b)} → ${L(v)}`;
      if (jeChyba(v)) popis += ' – ' + (v.proc || CHYBY[v.kod].popis);
      else if ('+-*/^'.includes(u.op) && [a, b].some(x => typeof x === 'string')) popis += ' (text, který vypadá jako číslo, se převedl na číslo)';
      else if (u.op === '&' && [a, b].some(x => typeof x === 'number')) popis += ' (číslo se převedlo na text)';
      return krok(v, popis);
    }
    case 'fn': {
      const d = u.en && FUNKCE[u.en];
      if (!d) return krok(new Chyba('NAME'), `funkce „${u.jmeno}“ neexistuje (nebo ji tato výuková verze nezná) – zkontrolujte překlep`);
      const nazev = nazevFunkce(u.en, ctx.jazyk), args = u.args;
      if (args.length < d.min || args.length > d.max) {
        return krok(new Chyba('VALUE'), `${nazev} potřebuje ${d.min === d.max ? d.min : d.min + ' až ' + (d.max === 255 ? 'mnoho' : d.max)} argumentů, dostala ${args.length}. Skutečný Excel by takový vzorec vůbec nepřijal.`);
      }
      /* líné funkce – vyhodnotí se jen potřebná větev */
      if (u.en === 'IF') {
        const b = zachyt(() => logika(vyhodnotUzel(args[0], ctx)));
        if (jeChyba(b)) return krok(b, `${nazev}: podmínka je chyba nebo není logická hodnota → ${L(b)}`);
        const vetev = b ? args[1] : args[2];
        const v = !vetev ? b : vetev.t === 'prazdny' ? 0 : vyhodnotUzel(vetev, ctx);
        return krok(v, `${nazev}: podmínka je ${logikaText(b, ctx.jazyk)} → vrací ${b ? '2. argument (hodnota_ano)' : '3. argument (hodnota_ne)'} = ${L(v)}${!vetev ? ' – argument chybí, proto logická hodnota' : ''}. ${b ? 'Třetí' : 'Druhý'} argument se vůbec nepočítá.`);
      }
      if (u.en === 'IFS') {
        for (let i = 0; i + 1 < args.length; i += 2) {
          const b = zachyt(() => logika(vyhodnotUzel(args[i], ctx)));
          if (jeChyba(b)) return krok(b, `${nazev}: podmínka č. ${i / 2 + 1} je chyba`);
          if (b) { const v = vyhodnotUzel(args[i + 1], ctx); return krok(v, `${nazev}: první pravdivá je podmínka č. ${i / 2 + 1} → ${L(v)}`); }
        }
        return krok(new Chyba('NA'), `${nazev}: žádná podmínka neplatí → chyba (tip: jako poslední podmínku dejte PRAVDA)`);
      }
      if (u.en === 'IFERROR' || u.en === 'IFNA') {
        const v = vyhodnotUzel(args[0], ctx);
        const sv = jePole(v) ? v.h[0][0] : v;
        if (jeChyba(sv) && (u.en === 'IFERROR' || sv.kod === 'NA')) {
          const n = args[1].t === 'prazdny' ? 0 : vyhodnotUzel(args[1], ctx);
          return krok(n, `${nazev}: 1. argument je chyba ${L(sv)} → vrací náhradu ${L(n)}`);
        }
        return krok(v, `${nazev}: 1. argument ${jeChyba(sv) ? 'je jiná chyba než #NENÍ_K_DISPOZICI' : 'není chyba'} → vrací ho beze změny`);
      }
      const hodn = args.map(x => (x.t === 'prazdny' ? null : vyhodnotUzel(x, ctx)));
      const pom = { jazyk: ctx.jazyk };
      const v = zachyt(() => { const x = d.fn(hodn, pom); return x === undefined ? null : x; });
      let popis;
      if (jeChyba(v)) popis = `${nazev} → ${L(v)}: ${v.proc || CHYBY[v.kod].popis}`;
      else {
        let extra = '';
        if (d.vysvetli) { try { extra = d.vysvetli(hodn, v, pom); } catch (e) { extra = ''; } }
        popis = `${nazev}: ${extra || d.popis.replace(/\.$/, '').replace(/^./, c => c.toLowerCase()) + ' → ' + L(v)}`;
      }
      return krok(v, popis);
    }
  }
  throw new Error('neznámý uzel ' + u.t);
}

/* ---------- list (sešit o jednom listu) ---------- */
class List {
  constructor(bunky = {}, volby = {}) {
    this.bunky = {};       /* adresa → zadaný text */
    this.format = {};      /* adresa → 'datum' | '%' | 'kc' | '0,00' */
    this.jazyk = volby.jazyk || 'cs';
    this.radku = volby.radku || 1;
    this.sloupcu = volby.sloupcu || 1;
    this.cache = new Map();
    this.pocita = new Set();
    for (const [a, v] of Object.entries(bunky)) this.nastav(a, v);
  }
  nastav(a, v) {
    a = a.toUpperCase();
    if (v && typeof v === 'object') { if (v.f) this.format[a] = v.f; v = v.v ?? ''; }
    v = v === null || v === undefined ? '' : String(v);
    if (v === '') delete this.bunky[a]; else this.bunky[a] = v;
    this.cache = new Map();
    const p = rozeberAdresu(a);
    if (p) { this.radku = Math.max(this.radku, p.r); this.sloupcu = Math.max(this.sloupcu, p.c); }
  }
  surova(a) { return this.bunky[a.toUpperCase()] ?? ''; }
  konstanta(s) {
    if (s.startsWith("'")) return s.slice(1);
    const n = textNaCislo(s); if (n !== null) return n;
    const d = textNaDatum(s); if (d !== null) return d;
    const u = s.trim().toUpperCase();
    if (u === 'PRAVDA' || u === 'TRUE') return true;
    if (u === 'NEPRAVDA' || u === 'FALSE') return false;
    return s;
  }
  hodnota(a, kroky = null) {
    a = a.toUpperCase();
    if (!kroky && this.cache.has(a)) return this.cache.get(a);
    const s = this.surova(a);
    let v;
    if (!s) v = null;
    else if (!s.startsWith('=')) v = this.konstanta(s);
    else {
      if (this.pocita.has(a)) return new Chyba('CIRC', `buňka ${a} (i oklikou) odkazuje sama na sebe`);
      this.pocita.add(a);
      try {
        v = vyhodnotUzel(rozeber(s, this.jazyk), { jazyk: this.jazyk, kroky, bunka: (r, c) => this.hodnota(adresa(r, c)) });
      } catch (e) {
        if (e instanceof Chyba) v = e;
        else if (e.syntaxe) v = new Chyba('NAME', 'chyba zápisu: ' + e.message);
        else throw e;
      } finally { this.pocita.delete(a); }
    }
    if (!kroky) this.cache.set(a, v);
    return v;
  }
  /* kroky vyhodnocení vzorce (v kontextu listu) */
  kroky(vzorec) {
    const strom = rozeber(vzorec, this.jazyk), kroky = [];
    let v;
    try { v = vyhodnotUzel(strom, { jazyk: this.jazyk, kroky, bunka: (r, c) => this.hodnota(adresa(r, c)) }); }
    catch (e) { if (e instanceof Chyba) v = e; else throw e; }
    return { strom, kroky, vysledek: v };
  }
  jeDatum(a, hloubka = 0) {
    a = a.toUpperCase();
    if (this.format[a]) return this.format[a] === 'datum';
    const s = this.surova(a);
    if (!s || hloubka > 20) return false;
    if (!s.startsWith('=')) return textNaDatum(s) !== null;
    try {
      let u = rozeber(s, this.jazyk);
      while (u.t === 'zav') u = u.x;
      const dat = x => (x.t === 'ref' && this.jeDatum(adresa(x.r, x.c), hloubka + 1)) || (x.t === 'fn' && x.en && FUNKCE[x.en].datum);
      if (u.t === 'op' && (u.op === '+' || u.op === '-')) return u.op === '+' ? dat(u.l) !== dat(u.r) : dat(u.l) && !dat(u.r);
      return !!dat(u);
    } catch (e) { return false; }
  }
  zobraz(a) {
    let v = this.hodnota(a);
    if (jePole(v)) v = v.h[0][0];
    if (v === null || v === undefined) return '';
    if (jeChyba(v)) return CHYBY[v.kod][this.jazyk === 'en' ? 'en' : 'cs'];
    if (typeof v === 'boolean') return logikaText(v, this.jazyk);
    if (typeof v === 'number') {
      const f = this.format[a.toUpperCase()];
      if (f === '%') return fmtCislo(zaokr(v * 100, 2), this.jazyk) + ' %';
      if (f === 'kc') return formatujText(v, '# ##0,00', this.jazyk) + ' Kč';
      if (f === '0,00') return formatujText(v, '0,00', this.jazyk);
      if (this.jeDatum(a)) return fmtDatum(v);
      return fmtCislo(v, this.jazyk);
    }
    return v;
  }
  /* zkopíruje obsah buňky do cíle s posunem relativních odkazů */
  kopiruj(z, na) {
    const s = this.surova(z), pz = rozeberAdresu(z), pn = rozeberAdresu(na);
    let nove = s;
    if (s.startsWith('=')) { try { nove = posunVzorec(s, pn.r - pz.r, pn.c - pz.c, this.jazyk); } catch (e) { /* chybný vzorec se kopíruje beze změny */ } }
    this.nastav(na, nove);
    if (this.format[z.toUpperCase()]) this.format[na.toUpperCase()] = this.format[z.toUpperCase()];
  }
  klon() {
    const l = new List({}, { jazyk: this.jazyk, radku: this.radku, sloupcu: this.sloupcu });
    l.bunky = { ...this.bunky }; l.format = { ...this.format }; return l;
  }
  /* přepne jazyk zápisu – vzorce i desetinná čísla se přeloží */
  prepniJazyk(na) {
    if (na === this.jazyk) return;
    for (const [a, s] of Object.entries(this.bunky)) {
      if (s.startsWith('=')) this.bunky[a] = prelozVzorec(s, this.jazyk, na);
      else if (na === 'en' && /^-?\d+,\d+$/.test(s)) this.bunky[a] = s.replace(',', '.');
      else if (na === 'cs' && /^-?\d+\.\d+$/.test(s)) this.bunky[a] = s.replace('.', ',');
    }
    this.jazyk = na;
    this.cache = new Map();
  }
}

/* ---------- pomůcky pro editor ---------- */
/* odkazy ve vzorci s pozicemi (pro barevné zvýraznění) */
function odkazyVeVzorci(vzorec, jazyk) {
  if (!String(vzorec).startsWith('=')) return [];
  let tok;
  try { tok = tokenizuj(vzorec.slice(1), jazyk, true); } catch (e) { return []; }
  const out = [];
  for (let i = 0; i < tok.length; i++) {
    const k = tok[i];
    if (k.t !== 'ref') continue;
    const b = tok[i + 2];
    if (tok[i + 1] && tok[i + 1].t === 'op' && tok[i + 1].v === ':' && b && b.t === 'ref') {
      out.push({ s: k.s + 1, e: b.e + 1, r1: Math.min(k.r, b.r), c1: Math.min(k.c, b.c), r2: Math.max(k.r, b.r), c2: Math.max(k.c, b.c) });
      i += 2;
    } else out.push({ s: k.s + 1, e: k.e + 1, r1: k.r, c1: k.c, r2: k.r, c2: k.c });
  }
  return out;
}
/* tokeny pro obarvení syntaxe (tolerantně i u nedopsaného vzorce) */
function tokenyProZvyrazneni(vzorec, jazyk) {
  if (!String(vzorec).startsWith('=')) return [];
  try { return tokenizuj(vzorec.slice(1), jazyk, true).map(k => ({ ...k, s: k.s + 1, e: k.e + 1 })); }
  catch (e) {
    let pred = [];
    try { pred = tokenizuj(vzorec.slice(1, e.pozice + 1), jazyk, true).map(k => ({ ...k, s: k.s + 1, e: k.e + 1 })); } catch (e2) { /* nic */ }
    return pred.concat([{ t: 'chyba', s: e.pozice + 1, e: e.pozice + 2 }]);
  }
}
/* ve které funkci a v kolikátém argumentu je kurzor; případně rozepsaný název funkce */
function napovedaKurzoru(vzorec, kurzor, jazyk) {
  if (!String(vzorec).startsWith('=')) return null;
  const pred = vzorec.slice(0, kurzor);
  const m = /([A-Za-zÀ-ž][\wÀ-ž.]*)$/.exec(pred);
  const zacatek = m && !/^[A-Za-z]{1,3}\d+$/.test(m[1]) && !/\$/.test(m[1]) && !/"/.test(pred.slice(-m[1].length - 1, -m[1].length)) ? m[1] : null;
  let tok;
  try { tok = tokenizuj(pred.slice(1), jazyk, true); } catch (e) { return zacatek ? { zacatek } : null; }
  if (tok.length && tok[tok.length - 1].t === 'str' && !pred.endsWith('"')) return null;   /* uvnitř textu */
  const zasobnik = [];
  for (let i = 0; i < tok.length; i++) {
    const k = tok[i];
    if (k.t === 'fn' && tok[i + 1] && tok[i + 1].t === 'lp') { zasobnik.push({ jmeno: k.v, arg: 0 }); i++; }
    else if (k.t === 'lp') zasobnik.push(null);
    else if (k.t === 'rp') zasobnik.pop();
    else if (k.t === 'sep' && zasobnik.length && zasobnik[zasobnik.length - 1]) zasobnik[zasobnik.length - 1].arg++;
  }
  let fn = null;
  for (let i = zasobnik.length - 1; i >= 0; i--) if (zasobnik[i]) { fn = zasobnik[i]; break; }
  const out = {};
  if (fn) { out.en = ALIAS[fn.jmeno] || null; out.jmeno = fn.jmeno; out.arg = fn.arg; }
  if (zacatek) out.zacatek = zacatek;
  return out.jmeno || out.zacatek ? out : null;
}
function navrhyFunkci(zacatek, jazyk) {
  const u = zacatek.toUpperCase();
  return Object.values(FUNKCE).filter(f => nazevFunkce(f.en, jazyk).startsWith(u)).map(f => f.en)
    .sort((a, b) => nazevFunkce(a, jazyk).localeCompare(nazevFunkce(b, jazyk), 'cs')).slice(0, 8);
}
/* F4: přepne $ u odkazu pod kurzorem: A1 → $A$1 → A$1 → $A1 → A1 */
function prepniAbsolutni(vzorec, kurzor) {
  const re = /\$?[A-Za-z]{1,3}\$?\d+/g;
  let m;
  while ((m = re.exec(vzorec))) {
    const z = m.index, k = z + m[0].length;
    if (kurzor >= z && kurzor <= k) {
      const p = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(m[0]);
      const dalsi = { 0: 3, 3: 1, 1: 2, 2: 0 }[(p[1] ? 2 : 0) + (p[3] ? 1 : 0)];
      const nov = (dalsi & 2 ? '$' : '') + p[2] + (dalsi & 1 ? '$' : '') + p[4];
      return { text: vzorec.slice(0, z) + nov + vzorec.slice(k), kurzor: z + nov.length };
    }
  }
  return null;
}

/* ---------- kontrola úloh ---------- */
function stejne(a, b) {
  if (jePole(a)) a = a.h[0][0];
  if (jePole(b)) b = b.h[0][0];
  if (jeChyba(a) || jeChyba(b)) return jeChyba(a) && jeChyba(b) && a.kod === b.kod;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  if ((a === null || a === '') && (b === null || b === '')) return true;
  return a === b;
}
/* náhodná obměna číselných vstupů – aby nešlo opsat výsledek místo vzorce */
function obmenaDat(list, nahoda, chranit = []) {
  const l = list.klon();
  for (const [a, s] of Object.entries(list.bunky)) {
    if (s.startsWith('=') || chranit.includes(a)) continue;
    const n = textNaCislo(s);
    if (n === null || list.jeDatum(a) || /%/.test(s)) continue;
    const cele = Number.isInteger(n);
    let x = n * (0.6 + nahoda() * 0.8);
    x = cele ? Math.round(x) : zaokr(x, 2);
    if (x === n) x = n + 1;
    l.bunky[a] = l.jazyk === 'en' ? String(x) : String(x).replace('.', ',');
  }
  l.cache = new Map();
  return l;
}
function rozsah(oblastText) {
  const [a, b] = oblastText.split(':');
  const p = rozeberAdresu(a), q = rozeberAdresu(b || a), out = [];
  for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) out.push(adresa(r, c));
  return out;
}
function rozborStromu(strom) {
  const fn = new Set(), refy = [];
  (function pruchod(u) {
    if (!u) return;
    if (u.t === 'fn') { if (u.en) fn.add(u.en); u.args.forEach(pruchod); }
    else if (u.t === 'ref') refy.push(u);
    else if (u.t === 'range') refy.push(u.a, u.b);
    else if (u.t === 'op') { pruchod(u.l); pruchod(u.r); }
    else if (u.x) pruchod(u.x);
  })(strom);
  return { fn, refy };
}
/* zkontroluj(list, uloha, vzorec)
   uloha: { cil, reseni (anglický zápis), kopirovat?: 'D2:D6', vyzaduje?: ['IF'], absolutni?: bool,
            varianty?: [{A1:…}] | false, chranit?: [adresy, které se při obměně nemění], konstanta?: bool (stačí číslo/hodnota) }
   → { ok, zprava } */
function zkontroluj(list, uloha, vstup) {
  const jaz = list.jazyk;
  const s = String(vstup || '').trim();
  if (!s) return { ok: false, zprava: 'Buňka je prázdná – napište do ní vzorec.' };
  if (!s.startsWith('=')) return { ok: false, zprava: 'Vzorec musí začínat znakem =. Bez něj Excel bere obsah jako obyčejný text nebo číslo.' };
  let strom;
  try { strom = rozeber(s, jaz); } catch (e) { return { ok: false, zprava: 'Vzorec má chybu zápisu: ' + e.message, pozice: e.pozice }; }
  const { fn, refy } = rozborStromu(strom);
  for (const f of uloha.vyzaduje || []) {
    if (!fn.has(f)) return { ok: false, zprava: `Úloha chce použít funkci ${nazevFunkce(f, jaz)}.` };
  }
  if (!refy.length) return { ok: false, zprava: 'Vzorec neobsahuje žádný odkaz na buňku. Počítejte s buňkami (např. B2), ne s opsanými čísly – když se data změní, výsledek se musí sám přepočítat.' };
  if (uloha.absolutni && !refy.some(r => r.absR || r.absC)) return { ok: false, zprava: 'Při kopírování se odkazy posouvají. Některý odkaz je potřeba ukotvit znakem $ (v poli vzorce klávesa F4).' };

  const reseni = prelozVzorec(uloha.reseni, 'en', jaz);
  const cile = uloha.kopirovat ? rozsah(uloha.kopirovat) : [uloha.cil];
  const pc = rozeberAdresu(uloha.cil);
  const sady = [list];
  let semeno = 12345;
  const nahoda = () => { semeno = (semeno * 16807) % 2147483647; return semeno / 2147483647; };
  if (Array.isArray(uloha.varianty)) uloha.varianty.forEach(v => { const l = list.klon(); for (const [a, x] of Object.entries(v)) l.nastav(a, x); sady.push(l); });
  else if (uloha.varianty !== false) for (let i = 0; i < 3; i++) sady.push(obmenaDat(list, nahoda, uloha.chranit));
  const lit = v => literal(jePole(v) ? v.h[0][0] : v, jaz);

  for (let si = 0; si < sady.length; si++) {
    const st = sady[si].klon(), ref = sady[si].klon();
    for (const c of cile) {
      const p = rozeberAdresu(c);
      st.nastav(c, posunVzorec(s, p.r - pc.r, p.c - pc.c, jaz));
      ref.nastav(c, posunVzorec(reseni, p.r - pc.r, p.c - pc.c, jaz));
    }
    for (const c of cile) {
      const a = st.hodnota(c), b = ref.hodnota(c);
      if (stejne(a, b)) continue;
      let zprava;
      if (si > 0) zprava = `S původními daty to vychází, ale po změně vstupních čísel vzorec v ${c} vrací ${lit(a)} místo ${lit(b)}. Nepočítá s opsaným číslem místo odkazu na buňku?`;
      else if (c !== uloha.cil) zprava = `V buňce ${uloha.cil} to vychází, ale po zkopírování do ${c} vzorec vrací ${lit(a)} místo ${lit(b)}. Které odkazy se mají při kopírování posouvat a které ukotvit znakem $?`;
      else zprava = `Vzorec vrací ${lit(a)}, ale správný výsledek je ${lit(b)}.`;
      return { ok: false, zprava };
    }
  }
  return { ok: true, zprava: cile.length > 1 ? `Správně! Vzorec funguje ve všech ${cile.length} buňkách i po změně dat.` : 'Správně! Vzorec funguje i po změně vstupních dat.' };
}

koren.XLV = {
  Chyba, CHYBY, FUNKCE, ALIAS, List,
  tokenizuj, rozeber, vykresli, literal, vyhodnotUzel, posunStrom, posunVzorec, prelozVzorec,
  odkazyVeVzorci, tokenyProZvyrazneni, napovedaKurzoru, navrhyFunkci, prepniAbsolutni, zkontroluj, rozborStromu,
  adresa, rozeberAdresu, sloupecNaCislo, cisloNaSloupec, fmtCislo, fmtDatum, serialZData, nazevFunkce, oddelovac, jeChyba, jePole, textRef,
};
})(typeof window !== 'undefined' ? window : globalThis);
