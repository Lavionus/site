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
  SPILL: { cs: '#ROZLITÍ!', en: '#SPILL!', popis: 'Výsledek je pole hodnot a nemá kam se rozlít – v cestě jsou neprázdné buňky.' },
  CALC: { cs: '#VÝPOČET!', en: '#CALC!', popis: 'Výpočet nemá výsledek – např. FILTR nenašel žádnou hodnotu.' },
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
/* pořadové číslo dne jako Excel: 1 = 1. 1. 1900; Excel má navíc neexistující 29. 2. 1900 (číslo 60),
   proto jsou data před 1. 3. 1900 o jedničku menší než prostý počet dní */
const serialZData = (y, m, d) => { const s = Math.round((Date.UTC(y, m - 1, d) - NULA_DAT) / DEN_MS); return s < 61 ? s - 1 : s; };
function datumZeSerialu(n) { n = Math.floor(n); const d = new Date(NULA_DAT + (n < 61 ? n + 1 : n) * DEN_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dt: d.getUTCDay() }; }
let JAZYK_VYPOCTU = 'cs';   /* jazyk zápisu právě počítaného listu (desetinná čárka × tečka) */
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];

function fmtCislo(n, jazyk) {
  if (!isFinite(n)) return jazyk === 'en' ? '#NUM!' : '#ČÍSLO!';
  const a = Math.abs(n);
  let s;
  if (a !== 0 && (a >= 1e15 || a < 1e-6)) {   /* vědecký zápis jako Excel: 1E+20, 1,5E-07 */
    const [m, e] = n.toExponential(14).split('e');
    s = String(parseFloat(m)) + 'E' + (+e < 0 ? '-' : '+') + String(Math.abs(+e)).padStart(2, '0');
  } else s = String(parseFloat(n.toPrecision(15)));
  return jazyk === 'en' ? s : s.replace('.', ',');
}
function fmtDatum(n) { const d = datumZeSerialu(n); return d.d + '. ' + d.m + '. ' + d.y; }

/* text → číslo (přijme desetinnou čárku i tečku a mezery jako oddělovač tisíců) */
function textNaCislo(t, jaz = JAZYK_VYPOCTU) {
  let s = String(t).trim();
  if (jaz === 'en') {   /* anglicky: čárka = oddělovač tisíců (1,234.5), jinak čárka v čísle není */
    if (/^[+-]?\d{1,3}(,\d{3})+(\.\d*)?\s?%?$/.test(s)) s = s.replace(/,/g, '');
    else if (s.includes(',')) return null;
  } else s = s.replace(/[  ](?=\d{3}(\D|$))/g, '');
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
  const s = serialZData(y, mo, d), z = datumZeSerialu(s);
  return z.d === d && z.m === mo ? s : null;   /* 31. 2. není datum – zůstane textem */
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
  if (v === null || v === undefined) return 0;   /* prázdná buňka = 0, ale prázdný text "" je chyba */
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
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (jePole(a)) { for (const radek of a.h) for (const v of radek) yield { v, zOblasti: true }; }
    else yield { v: a, zOblasti: !!(args.zOdkazu && args.zOdkazu[i]) };   /* =SUMA(A1) s textem v A1 = 0, jako oblast (Excel) */
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
  if (typeof k === 'boolean') return v => v === k;
  if (typeof k === 'number') k = String(k);
  k = k === null || k === undefined ? '' : String(k);
  if (k === '=') return v => v === null || v === undefined;   /* "=" = jen opravdu prázdné buňky */
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(k);
  const op = m[1] || '=', zbytek = m[2];
  const n = zbytek === '' ? null : (textNaCislo(zbytek) ?? textNaDatum(zbytek));
  const test = c => op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
  if (n !== null) return v => {
    /* při rovnosti Excel porovná i číslo uložené jako text („7“) */
    let x = typeof v === 'number' ? v : null;
    if (x === null && typeof v === 'string' && (op === '=' || op === '<>')) x = textNaCislo(v);
    return x === null ? op === '<>' : test(porovnej(x, n));
  };
  if (zbytek === '') return op === '<>' ? (v => v !== null && v !== undefined && v !== '') : (v => v === null || v === undefined || v === '');
  if (op === '=' || op === '<>') {
    /* textové kritérium (i se zástupnými znaky) porovnává jen text, ne čísla */
    const re = vzorNaRegex(zbytek);
    const shoda = v => typeof v === 'string' ? re.test(v) : typeof v === 'boolean' ? re.test(logikaText(v, 'en')) || re.test(logikaText(v, 'cs')) : false;
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
      mmmm: MESICE[d.m - 1], mmm: ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'][d.m - 1], mm: String(d.m).padStart(2, '0'), m: d.m,
      yyyy: d.y, rrrr: d.y, yy: String(d.y).slice(2), rr: String(d.y).slice(2),
    })[t]));
  }
  const pct = f.includes('%');
  if (pct) n *= 100;
  /* desetinný oddělovač formátu podle jazyka: en „#,##0.00“, cs „# ##0,00“ (cs přijme i „0.00“) */
  const desOdd = jazyk === 'en' ? '.' : (f.includes(',') ? ',' : '.');
  const des = (new RegExp('\\' + desOdd + '([0#]+)').exec(f) || [, ''])[1].length;
  const tisice = jazyk === 'en' || desOdd === '.' ? /#,##0/.test(f) || /# ##0/.test(f) : /# ##0/.test(f);
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
const chybi = v => v === undefined;   /* vynechaný argument; prázdný argument (null) = 0 / NEPRAVDA / "" */
function mocnina(a, b) {
  if (a === 0 && b === 0) chyba('NUM', '0 na nultou není definováno');
  if (a === 0 && b < 0) chyba('DIV0', 'nula na zápornou mocninu = dělení nulou');
  const x = Math.pow(a, b);
  if (!isFinite(x) || isNaN(x)) chyba('NUM', 'výsledek mocniny není reálné číslo');
  return x;
}
const datumArg = v => { const n = cislo(v); if (n < 0) chyba('NUM', 'záporné číslo není datum'); return datumZeSerialu(n); };

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
    for (const x of pole) { const v = x[i]; if (jeChyba(v)) throw v; m *= typeof v === 'number' ? v : 0; }   /* logické hodnoty se nepočítají – proto se v Excelu píše -- */
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
def('Matematika', 'POWER', 'POWER', ['číslo', 'mocnina'], 'Umocní číslo (totéž co ^).', a => mocnina(N(a[0]), N(a[1])));

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
def('Logické', 'TRUE', 'PRAVDA', [], 'Logická hodnota PRAVDA (stejné jako napsat PRAVDA).', () => true);
def('Logické', 'FALSE', 'NEPRAVDA', [], 'Logická hodnota NEPRAVDA.', () => false);
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
def('Vyhledávání', 'ROWS', 'ŘÁDKY', ['pole'], 'Počet řádků oblasti nebo pole.', a => { const t = oblast(a[0]); return t.h.length; });
def('Vyhledávání', 'COLUMNS', 'SLOUPCE', ['pole'], 'Počet sloupců oblasti nebo pole.', a => { const t = oblast(a[0]); return t.h[0].length; });
def('Vyhledávání', 'INDEX', 'INDEX', ['pole', 'řádek', '[sloupec]'], 'Vrátí hodnotu na zadaném řádku a sloupci oblasti.', a => {
  const t = oblast(a[0]); let r = Math.trunc(N(a[1])), c = chybi(a[2]) ? null : Math.trunc(N(a[2]));
  if (c === null) { if (t.h.length === 1) { c = r; r = 1; } else c = t.h[0].length === 1 ? 1 : 0; }
  if (r < 0 || c < 0 || r > t.h.length || c > t.h[0].length) chyba('REF', 'řádek nebo sloupec je mimo oblast');
  if (r === 0 && c === 0) return { h: t.h.map(x => [...x]), pole: true };
  if (r === 0) return { h: t.h.map(x => [x[c - 1]]), pole: true };   /* řádek 0 = celý sloupec */
  if (c === 0) return { h: [[...t.h[r - 1]]], pole: true };          /* sloupec 0 = celý řádek */
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
def('Text', 'LEFT', 'ZLEVA', ['text', '[počet_znaků]'], 'Prvních N znaků zleva.', (a, p) => { const n = chybi(a[1]) ? 1 : Math.trunc(N(a[1])); if (n < 0) chyba('VALUE'); return T(a[0], p).slice(0, n); });
def('Text', 'RIGHT', 'ZPRAVA', ['text', '[počet_znaků]'], 'Posledních N znaků zprava.', (a, p) => { const n = chybi(a[1]) ? 1 : Math.trunc(N(a[1])); if (n < 0) chyba('VALUE'); return n === 0 ? '' : T(a[0], p).slice(-n); });
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
  const kde = T(a[1], p), s = chybi(a[2]) ? 1 : Math.trunc(N(a[2]));
  if (s < 1 || s > kde.length + 1) chyba('VALUE', 'začátek hledání je mimo text');
  const i = kde.indexOf(T(a[0], p), s - 1); if (i < 0) chyba('VALUE', 'hledaný text tam není'); return i + 1;
}, { vysvetli: (a, v, p) => `"${T(a[0], p)}" začíná na ${v}. znaku textu "${T(a[1], p)}"` });
def('Text', 'SEARCH', 'HLEDAT', ['co', 'kde', '[start]'], 'Pozice textu v textu (nerozlišuje velikost písmen, umí * a ?).', (a, p) => {
  const s = chybi(a[2]) ? 1 : Math.trunc(N(a[2]));
  if (s < 1 || s > T(a[1], p).length + 1) chyba('VALUE', 'začátek hledání je mimo text');
  const m = vzorNaRegex(T(a[0], p), false).exec(T(a[1], p).slice(s - 1));
  if (!m) chyba('VALUE', 'hledaný text tam není'); return m.index + s;
});
def('Text', 'SUBSTITUTE', 'DOSADIT', ['text', 'starý', 'nový', '[výskyt]'], 'Nahradí v textu jeden text jiným.', (a, p) => {
  const t = T(a[0], p), st = T(a[1], p), no = T(a[2], p); if (!st) return t;
  if (chybi(a[3])) return t.split(st).join(no);
  const k = Math.trunc(N(a[3])); if (k < 1) chyba('VALUE', 'výskyt musí být aspoň 1'); let i = -1;
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
def('Datum', 'DATE', 'DATUM', ['rok', 'měsíc', 'den'], 'Složí datum z roku, měsíce a dne (přetečení dopočítá: 32. 1. = 1. 2.).', a => {
  let y = Math.trunc(N(a[0]));
  if (y < 0 || y > 9999) chyba('NUM', 'rok musí být 0 až 9999');
  if (y < 1900) y += 1900;   /* Excel: rok 0–1899 se přičte k 1900 */
  const s = serialZData(y, Math.trunc(N(a[1])), Math.trunc(N(a[2])));
  if (s < 0) chyba('NUM', 'datum před rokem 1900'); return s;
},
{ datum: true, vysvetli: (a, v) => `${fmtDatum(v)} je ${v}. den od začátku roku 1900 – Excel ukládá datum jako číslo` });
def('Datum', 'YEAR', 'ROK', ['datum'], 'Rok z data.', a => datumArg(a[0]).y);
def('Datum', 'MONTH', 'MĚSÍC', ['datum'], 'Měsíc z data (1–12).', a => datumArg(a[0]).m);
def('Datum', 'DAY', 'DEN', ['datum'], 'Den v měsíci z data (1–31).', a => datumArg(a[0]).d);
def('Datum', 'WEEKDAY', 'DENTÝDNE', ['datum', '[typ]'], 'Den v týdnu: typ 1 = neděle 1 … sobota 7, typ 2 = pondělí 1 … neděle 7.', a => {
  const dt = datumArg(a[0]).dt, typ = chybi(a[1]) ? 1 : Math.trunc(N(a[1]));
  if (typ === 1 || typ === 17) return dt + 1;
  if (typ === 2) return (dt + 6) % 7 + 1;
  if (typ === 3) return (dt + 6) % 7;
  if (typ >= 11 && typ <= 16) return ((dt - (typ - 10) + 7) % 7) + 1;   /* 11 = od pondělí … 16 = od soboty */
  chyba('NUM', 'neplatný typ – použijte 1, 2, 3 nebo 11–17');
}, { vysvetli: (a, v) => `${fmtDatum(N(a[0]))} je ${DNY[datumZeSerialu(N(a[0])).dt]} → ${v}` });
def('Datum', 'EOMONTH', 'EOMONTH', ['datum', 'měsíce'], 'Poslední den měsíce posunutého o N měsíců.', a => {
  const d = datumArg(a[0]); return serialZData(d.y, d.m + Math.trunc(N(a[1])) + 1, 0);
}, { datum: true });
def('Datum', 'NETWORKDAYS', 'NETWORKDAYS', ['začátek', 'konec'], 'Počet pracovních dnů (po–pá) mezi daty včetně obou.', a => {
  let z = Math.floor(N(a[0])), k = Math.floor(N(a[1])), zn = 1; if (z > k) { [z, k] = [k, z]; zn = -1; }
  let n = 0; for (let x = z; x <= k && n < 100000; x++) { const dt = datumZeSerialu(x).dt; if (dt !== 0 && dt !== 6) n++; } return n * zn;
});

/* ---------- dynamická pole ---------- */
const pole = h => ({ h, pole: true });
const radkyPole = v => (jePole(v) ? v.h : [[v]]);
def('Dynamická pole', 'FILTER', 'FILTR', ['pole', 'zahrnout', '[když_prázdné]'], 'Vrátí jen řádky (nebo sloupce), u kterých je podmínka PRAVDA. Výsledek se rozlije.', a => {
  const p = radkyPole(a[0]), z = radkyPole(a[1]);
  let out;
  if (z.length === p.length && z[0].length === 1) out = p.filter((r, i) => logika(z[i][0]));
  else if (z.length === 1 && z[0].length === p[0].length) { const k = z[0].map(logika); out = p.map(r => r.filter((x, j) => k[j])); if (!out[0].length) out = []; }
  else chyba('VALUE', 'podmínka musí mít stejně řádků (nebo sloupců) jako pole');
  if (!out.length) { if (!chybi(a[2])) return a[2]; chyba('CALC', 'podmínku nesplňuje žádný řádek'); }
  return pole(out);
}, { vysvetli: (a, v, p) => `z ${radkyPole(a[0]).length} řádků splňuje podmínku ${jePole(v) ? v.h.length : 0} → výsledek se rozlije do ${jePole(v) ? v.h.length + ' × ' + v.h[0].length : 1} buněk` });
def('Dynamická pole', 'SORT', 'SEŘADIT', ['pole', '[index_řazení]', '[pořadí]', '[podle_sloupců]'], 'Seřadí řádky pole podle zvoleného sloupce (1 = vzestupně, −1 = sestupně).', a => {
  const p = radkyPole(a[0]).map(r => [...r]), i = chybi(a[1]) ? 1 : Math.trunc(N(a[1])), sm = chybi(a[2]) ? 1 : Math.sign(N(a[2])) || 1;
  const posl = !chybi(a[3]) && logika(a[3]);
  const data = posl ? p[0].map((_, c) => p.map(r => r[c])) : p;
  if (i < 1 || i > data[0].length) chyba('VALUE', 'index řazení je mimo pole');
  data.sort((x, y) => { const u = x[i - 1], w = y[i - 1]; const pu = u === null || u === undefined, pw = w === null || w === undefined; return pu || pw ? pu - pw : sm * porovnej(u, w); });
  return pole(posl ? data[0].map((_, r) => data.map(c => c[r])) : data);
});
def('Dynamická pole', 'UNIQUE', 'UNIKÁTNÍ', ['pole', '[podle_sloupců]', '[jen_jednou]'], 'Vrátí jedinečné řádky pole (každý jen jednou).', a => {
  const sloupce = !chybi(a[1]) && logika(a[1]), jen = !chybi(a[2]) && logika(a[2]);
  const vstup = radkyPole(a[0]), p = sloupce ? vstup[0].map((_, c) => vstup.map(r => r[c])) : vstup;
  const klic = r => JSON.stringify(r.map(x => (typeof x === 'string' ? x.toLowerCase() : x)));
  const pocty = new Map(); p.forEach(r => pocty.set(klic(r), (pocty.get(klic(r)) || 0) + 1));
  const videne = new Set(), out = [];
  for (const r of p) { const k = klic(r); if (videne.has(k) || (jen && pocty.get(k) > 1)) continue; videne.add(k); out.push(r); }
  if (!out.length) chyba('CALC');
  return pole(sloupce ? out[0].map((_, r) => out.map(c => c[r])) : out);
}, { vysvetli: (a, v) => `z ${radkyPole(a[0]).length} řádků je jedinečných ${jePole(v) ? v.h.length : 1}` });
def('Dynamická pole', 'SEQUENCE', 'POSLOUPNOST', ['řádky', '[sloupce]', '[začátek]', '[krok]'], 'Vytvoří pole po sobě jdoucích čísel (1, 2, 3…).', a => {
  const r = Math.trunc(N(a[0])), c = chybi(a[1]) ? 1 : Math.trunc(N(a[1])), z = chybi(a[2]) ? 1 : N(a[2]), k = chybi(a[3]) ? 1 : N(a[3]);
  if (r < 1 || c < 1 || r * c > 10000) chyba('VALUE', 'počet řádků a sloupců musí být 1 až 10 000 buněk');
  return pole(Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => z + (i * c + j) * k)));
});
def('Vyhledávání', 'XMATCH', 'XMATCH', ['hledat', 'prohledat', '[režim_shody]', '[režim_hledání]'], 'Pozice hodnoty v řádku nebo sloupci; přesná shoda je výchozí (Excel 2021/365).', a => {
  const hl = plosne(oblast(a[1])), rezim = chybi(a[2]) ? 0 : Math.trunc(N(a[2])), od = !chybi(a[3]) && N(a[3]) < 0;
  const h = skalar(a[0]); if (jeChyba(h)) throw h;
  const poradi = hl.map((v, i) => i); if (od) poradi.reverse();
  const re = rezim === 2 && typeof h === 'string' ? vzorNaRegex(h) : null;
  let n = poradi.find(i => { const v = hl[i]; return v !== null && v !== undefined && (re ? typeof v === 'string' && re.test(v) : porovnej(v, h) === 0); });
  if (n === undefined && (rezim === -1 || rezim === 1)) for (const i of poradi) {
    const v = hl[i]; if (v === null || v === undefined || typRad(v) !== typRad(h)) continue;
    const c = porovnej(v, h);
    if ((rezim === -1 ? c < 0 : c > 0) && (n === undefined || (rezim === -1 ? porovnej(v, hl[n]) > 0 : porovnej(v, hl[n]) < 0))) n = i;
  }
  if (n === undefined) chyba('NA', 'hodnota nenalezena'); return n + 1;
});
def('Logické', 'LET', 'LET', ['název1', 'hodnota1', 'výpočet…'], 'Pojmenuje mezivýsledky a použije je ve výpočtu – vzorec je kratší a přehlednější.', null, { min: 3 });
def('Text', 'TEXTBEFORE', 'TEXTPŘED', ['text', 'oddělovač', '[výskyt]'], 'Text před oddělovačem (např. jméno před mezerou).', (a, p) => {
  const t = T(a[0], p), d = T(a[1], p), k = chybi(a[2]) ? 1 : Math.trunc(N(a[2]));
  if (!d) return k > 0 ? '' : t;
  const casti = t.split(d); if (Math.abs(k) >= casti.length || k === 0) chyba('NA', 'oddělovač tam není');
  return k > 0 ? casti.slice(0, k).join(d) : casti.slice(0, casti.length + k).join(d);
});
def('Text', 'TEXTAFTER', 'TEXTZA', ['text', 'oddělovač', '[výskyt]'], 'Text za oddělovačem (např. příjmení za mezerou).', (a, p) => {
  const t = T(a[0], p), d = T(a[1], p), k = chybi(a[2]) ? 1 : Math.trunc(N(a[2]));
  if (!d) return k > 0 ? t : '';
  const casti = t.split(d); if (Math.abs(k) >= casti.length || k === 0) chyba('NA', 'oddělovač tam není');
  return k > 0 ? casti.slice(k).join(d) : casti.slice(casti.length + k).join(d);
});
/* statistika */
function rozptyl(a, vyber) {
  const c = cislaArg(a); if (c.length < (vyber ? 2 : 1)) chyba('DIV0', 'málo čísel');
  const m = c.reduce((x, y) => x + y, 0) / c.length;
  return c.reduce((x, y) => x + (y - m) ** 2, 0) / (c.length - (vyber ? 1 : 0));
}
def('Statistika', 'STDEV.S', 'SMODCH.VÝBĚR.S', ['číslo1', 'číslo2…'], 'Směrodatná odchylka výběru (dělí n − 1).', a => Math.sqrt(rozptyl(a, true)));
def('Statistika', 'STDEV', 'SMODCH.VÝBĚR', ['číslo1', 'číslo2…'], 'Směrodatná odchylka výběru (starší název STDEV.S).', a => Math.sqrt(rozptyl(a, true)));
def('Statistika', 'STDEV.P', 'SMODCH.P', ['číslo1', 'číslo2…'], 'Směrodatná odchylka celé populace (dělí n).', a => Math.sqrt(rozptyl(a, false)));
def('Statistika', 'VAR.S', 'VAR.VÝBĚR', ['číslo1', 'číslo2…'], 'Rozptyl výběru.', a => rozptyl(a, true));
def('Statistika', 'VAR.P', 'VAR.P', ['číslo1', 'číslo2…'], 'Rozptyl celé populace.', a => rozptyl(a, false));
def('Statistika', 'MODE.SNGL', 'MODE.SNGL', ['číslo1', 'číslo2…'], 'Nejčastější hodnota.', a => {
  const c = cislaArg(a), m = new Map(); c.forEach(x => m.set(x, (m.get(x) || 0) + 1));
  let nej = null, n = 1; for (const x of c) if (m.get(x) > n) { n = m.get(x); nej = x; }
  if (nej === null) chyba('NA', 'žádná hodnota se neopakuje'); return nej;
});
function percentil(c, k) { c = [...c].sort((x, y) => x - y); if (!c.length || k < 0 || k > 1) chyba('NUM'); const h = (c.length - 1) * k, d = Math.floor(h); return c[d] + (h - d) * ((c[d + 1] ?? c[d]) - c[d]); }
def('Statistika', 'PERCENTILE.INC', 'PERCENTIL.INC', ['pole', 'k'], 'K-tý percentil (k od 0 do 1; 0,5 = medián).', a => percentil(cislaArg([a[0]]), N(a[1])));
def('Statistika', 'QUARTILE.INC', 'QUARTIL.INC', ['pole', 'kvartil'], 'Kvartil (0 = min, 1 = 25 %, 2 = medián, 3 = 75 %, 4 = max).', a => percentil(cislaArg([a[0]]), Math.trunc(N(a[1])) / 4));
function podminkyHodnoty(a) {
  const s = plosne(a[0]), d = dvojice(a, 1); if (s.length !== d.n) chyba('VALUE', 'oblast hodnot má jinou velikost');
  const out = []; for (let i = 0; i < d.n; i++) if (d.plati(i) && typeof s[i] === 'number') out.push(s[i]); return out;
}
def('Podmíněné', 'AVERAGEIFS', 'AVERAGEIFS', ['průměr', 'oblast1', 'kritérium1', 'oblast2…', 'kritérium2…'], 'Průměr hodnot v řádcích, které splňují všechny podmínky.', a => { const c = podminkyHodnoty(a); if (!c.length) chyba('DIV0', 'podmínky nesplňuje žádné číslo'); return c.reduce((x, y) => x + y, 0) / c.length; });
def('Podmíněné', 'MAXIFS', 'MAXIFS', ['max', 'oblast1', 'kritérium1', 'oblast2…', 'kritérium2…'], 'Největší hodnota v řádcích, které splňují podmínky.', a => { const c = podminkyHodnoty(a); return c.length ? Math.max(...c) : 0; });
def('Podmíněné', 'MINIFS', 'MINIFS', ['min', 'oblast1', 'kritérium1', 'oblast2…', 'kritérium2…'], 'Nejmenší hodnota v řádcích, které splňují podmínky.', a => { const c = podminkyHodnoty(a); return c.length ? Math.min(...c) : 0; });
/* finance */
const typPlatby = x => (chybi(x) ? 0 : N(x) ? 1 : 0);
def('Finanční', 'PMT', 'PLATBA', ['sazba', 'počet_období', 'současná_hodnota', '[budoucí_hodnota]', '[typ]'], 'Splátka úvěru za období (záporná = platíte). Roční sazbu dělte 12 pro měsíce.', a => {
  const r = N(a[0]), n = N(a[1]), pv = N(a[2]), fv = chybi(a[3]) ? 0 : N(a[3]), t = typPlatby(a[4]);
  if (n === 0) chyba('NUM');
  if (r === 0) return -(pv + fv) / n;
  const q = Math.pow(1 + r, n); return -(r * (pv * q + fv)) / ((1 + r * t) * (q - 1));
}, { vysvetli: (a, v, p) => `splátka ${fmtCislo(zaokr(v, 2), p.jazyk)} za každé z ${N(a[1])} období (záporné číslo = peníze odcházejí)` });
def('Finanční', 'FV', 'BUDHODNOTA', ['sazba', 'počet_období', 'platba', '[současná_hodnota]', '[typ]'], 'Budoucí hodnota spoření nebo investice.', a => {
  const r = N(a[0]), n = N(a[1]), pmt = N(a[2]), pv = chybi(a[3]) ? 0 : N(a[3]), t = typPlatby(a[4]);
  if (r === 0) return -(pv + pmt * n);
  const q = Math.pow(1 + r, n); return -(pv * q + pmt * (1 + r * t) * (q - 1) / r);
});
def('Finanční', 'PV', 'SOUČHODNOTA', ['sazba', 'počet_období', 'platba', '[budoucí_hodnota]', '[typ]'], 'Současná hodnota řady budoucích plateb.', a => {
  const r = N(a[0]), n = N(a[1]), pmt = N(a[2]), fv = chybi(a[3]) ? 0 : N(a[3]), t = typPlatby(a[4]);
  if (r === 0) return -(fv + pmt * n);
  const q = Math.pow(1 + r, n); return -(fv + pmt * (1 + r * t) * (q - 1) / r) / q;
});
def('Finanční', 'NPV', 'ČISTÁ.SOUČHODNOTA', ['sazba', 'hodnota1', 'hodnota2…'], 'Čistá současná hodnota peněžních toků na konci období.', a => {
  const r = N(a[0]); return cislaArg(a.slice(1)).reduce((s, x, i) => s + x / Math.pow(1 + r, i + 1), 0);
});
def('Finanční', 'IRR', 'MÍRA.VÝNOSNOSTI', ['hodnoty', '[odhad]'], 'Vnitřní výnosové procento peněžních toků (aspoň jeden záporný a jeden kladný).', a => {
  const c = cislaArg([a[0]]); if (!c.some(x => x < 0) || !c.some(x => x > 0)) chyba('NUM', 'potřeba aspoň jeden záporný a jeden kladný tok');
  let r = chybi(a[1]) ? 0.1 : N(a[1]);
  for (let k = 0; k < 100; k++) {
    let f = 0, df = 0; c.forEach((x, i) => { f += x / Math.pow(1 + r, i); df -= i * x / Math.pow(1 + r, i + 1); });
    if (Math.abs(f) < 1e-10) return r;
    const n2 = r - f / df; if (!isFinite(n2)) break; if (Math.abs(n2 - r) < 1e-12) return n2; r = n2;
  }
  chyba('NUM', 'výpočet nekonverguje');
});
/* datum a zaokrouhlení */
def('Datum', 'DATEDIF', 'DATEDIF', ['začátek', 'konec', 'jednotka'], 'Rozdíl dat v celých rocích ("Y"), měsících ("M") nebo dnech ("D"); také "YM", "MD", "YD".', (a, p) => {
  const z = Math.floor(N(a[0])), k = Math.floor(N(a[1])), j = T(a[2], p).toUpperCase();
  if (z > k) chyba('NUM', 'začátek je po konci');
  const d1 = datumZeSerialu(z), d2 = datumZeSerialu(k);
  let mes = (d2.y - d1.y) * 12 + d2.m - d1.m; if (d2.d < d1.d) mes--;
  switch (j) {
    case 'Y': return Math.floor(mes / 12);
    case 'M': return mes;
    case 'D': return k - z;
    case 'YM': return mes % 12;
    case 'MD': { let x = d2.d - d1.d; if (x < 0) x += new Date(Date.UTC(d2.y, d2.m - 1, 0)).getUTCDate(); return x; }
    case 'YD': { let s1 = serialZData(d2.y, d1.m, d1.d); if (s1 > k) s1 = serialZData(d2.y - 1, d1.m, d1.d); return k - s1; }
  }
  chyba('NUM', 'neznámá jednotka – použijte "Y", "M", "D", "YM", "MD" nebo "YD"');
}, { vysvetli: (a, v, p) => `od ${fmtDatum(N(a[0]))} do ${fmtDatum(N(a[1]))} uplynulo ${v} (jednotka ${T(a[2], p).toUpperCase()})` });
def('Matematika', 'MROUND', 'MROUND', ['číslo', 'násobek'], 'Zaokrouhlí na nejbližší násobek (např. na 5 haléřů).', a => {
  const x = N(a[0]), m = N(a[1]); if (m === 0) return 0; if (Math.sign(x) * Math.sign(m) < 0) chyba('NUM', 'číslo a násobek mají různá znaménka');
  return Number((zaokr(x / m, 0) * m).toPrecision(15));
});
def('Matematika', 'TRUNC', 'USEKNOUT', ['číslo', '[počet_číslic]'], 'Usekne desetinná místa bez zaokrouhlení.', a => zaokr(N(a[0]), chybi(a[1]) ? 0 : Math.trunc(N(a[1])), 'dolu'));

const nazevFunkce = (en, jazyk) => jazyk === 'en' ? en : FUNKCE[en].cs;
const oddelovac = jazyk => jazyk === 'en' ? ',' : ';';

/* ---------- tokenizace ---------- */
function chybaSyntaxe(zprava, pozice) { const e = new Error(zprava); e.syntaxe = true; e.pozice = pozice; return e; }
const PISMENO = /[A-Za-zÀ-ž_]/;
/* ---------- tabulky: strukturované odkazy ---------- */
/* obsah hranatých závorek od pozice i (s[i] === '['), vnořené závorky se počítají */
function ctiHranate(s, i, tolerantne) {
  let h = 0, j = i;
  for (; j < s.length; j++) {
    if (s[j] === "'" && j + 1 < s.length) { j++; continue; }   /* '[ = znak závorky v názvu sloupce */
    if (s[j] === '[') h++;
    else if (s[j] === ']' && --h === 0) return { text: s.slice(i + 1, j), konec: j + 1 };
  }
  if (tolerantne) return { text: s.slice(i + 1), konec: s.length };
  throw chybaSyntaxe('Chybí uzavírací hranatá závorka ] strukturovaného odkazu', i);
}
/* český Excel: #Vše, #Data, #Záhlaví, #Součty, #Tento řádek (#Souhrny bereme jako starší alias) */
const KLIC_TAB = { '#ALL': 'vse', '#VŠE': 'vse', '#DATA': 'data', '#HEADERS': 'hlavicky', '#ZÁHLAVÍ': 'hlavicky', '#TOTALS': 'souhrny', '#SOUČTY': 'souhrny', '#SOUHRNY': 'souhrny', '#THIS ROW': 'radek', '#TENTO ŘÁDEK': 'radek' };
const SLOVA_TAB = { vse: ['#All', '#Vše'], data: ['#Data', '#Data'], hlavicky: ['#Headers', '#Záhlaví'], souhrny: ['#Totals', '#Součty'], radek: ['#This Row', '#Tento řádek'] };
/* kombinace částí: hd = záhlaví + data, dt = data + součty */
const SLOZENE_TAB = { hd: ['hlavicky', 'data'], dt: ['data', 'souhrny'] };
/* text uvnitř Tab[…] → { cast: data|vse|hlavicky|souhrny|radek, sl1, sl2 } */
function rozeberSpec(t, poz = 0) {
  t = String(t).trim();
  const nazev = x => x.replace(/'(.)/g, '$1').trim();
  if (t === '') return { cast: 'data' };
  if (t[0] === '@') {   /* [@Sl], [@[Sl s mezerou]], [@[A]:[B]] */
    const x = t.slice(1).trim();
    if (!x) return { cast: 'radek', sl1: null };
    if (x[0] !== '[') return { cast: 'radek', sl1: nazev(x) };
    const r = rozeberSpec(x, poz);
    return { cast: 'radek', sl1: r.sl1, sl2: r.sl2 };
  }
  if (t[0] === '#') { const k = KLIC_TAB[t.toUpperCase()]; if (!k) throw chybaSyntaxe(`Neznámé klíčové slovo tabulky „${t}“ (#Vše, #Data, #Záhlaví, #Součty)`, poz); return { cast: k }; }
  if (t[0] !== '[') return { cast: 'data', sl1: nazev(t) };
  const casti = new Set(); const sloupce = []; let i = 0, rozsah = false;
  while (i < t.length) {
    const ch = t[i];
    if (ch === ' ' || ch === ',' || ch === ';') { i++; continue; }
    if (ch === ':') { rozsah = true; i++; continue; }
    if (ch !== '[') throw chybaSyntaxe('Strukturovaný odkaz: položky patří do hranatých závorek, např. Tab[[#Vše];[Cena]]', poz);
    const h = ctiHranate(t, i, false); i = h.konec;
    const x = h.text;
    if (x.trim().startsWith('#')) { const k = KLIC_TAB[x.trim().toUpperCase()]; if (!k) throw chybaSyntaxe(`Neznámé klíčové slovo tabulky „${x.trim()}“`, poz); casti.add(k); }
    else if (x.trim().startsWith('@')) { casti.add('radek'); sloupce.push(nazev(x.trim().slice(1).replace(/^\[|\]$/g, ''))); }
    else sloupce.push(x.replace(/'(.)/g, '$1'));   /* název sloupce uvnitř [ ] se neořezává – mezery na krajích patří k názvu */
  }
  if (sloupce.length > 2 || (sloupce.length === 2 && !rozsah)) throw chybaSyntaxe('Strukturovaný odkaz může obsahovat jeden sloupec nebo rozsah sloupců [A]:[B]', poz);
  let cast = 'data';
  if (casti.has('radek')) cast = 'radek';
  else if (casti.has('vse') || (casti.has('hlavicky') && casti.has('souhrny'))) cast = 'vse';
  else if (casti.has('hlavicky') && casti.has('data')) cast = 'hd';
  else if (casti.has('data') && casti.has('souhrny')) cast = 'dt';
  else if (casti.size) cast = [...casti][0];
  return { cast, sl1: sloupce[0] ?? null, sl2: rozsah && sloupce[1] !== undefined ? sloupce[1] : null };
}
function textTab(u, jazyk = 'cs') {
  const odd = jazyk === 'en' ? ',' : ';';
  const jednoduchy = n => /^[A-Za-zÀ-ž_][\wÀ-ž]*$/.test(n);
  const br = n => '[' + n.replace(/([[\]#'@])/g, "'$1") + ']';
  const kws = (SLOZENE_TAB[u.cast] || [u.cast]).map(c => SLOVA_TAB[c][jazyk === 'en' ? 0 : 1]);
  let spec;
  if (u.cast === 'radek') spec = '@' + (u.sl1 === null || u.sl1 === undefined ? '' : u.sl2 ? br(u.sl1) + ':' + br(u.sl2) : jednoduchy(u.sl1) ? u.sl1 : br(u.sl1));
  else if (u.cast === 'data' && !u.sl1) spec = '';
  else if (u.cast === 'data' && !u.sl2) spec = /^[\wÀ-ž ]+$/.test(u.sl1) && !/^ | $/.test(u.sl1) ? u.sl1 : br(u.sl1);
  else if (!u.sl1 && kws.length === 1) spec = kws[0];
  else spec = [...(u.cast === 'data' ? [] : kws.map(k => '[' + k + ']')), ...(u.sl1 ? [br(u.sl1) + (u.sl2 ? ':' + br(u.sl2) : '')] : [])].join(odd);
  return (u.tab || '') + '[' + spec + ']';
}
/* oblast strukturovaného odkazu podle tabulky o = {r1,c1,r2,c2,souhrn,sloupce[]}; kde = buňka vzorce {r,c} */
function oblastTab(u, o, kde) {
  const sl = n => { const i = o.sloupce.findIndex(x => x.toUpperCase() === String(n).toUpperCase()); if (i < 0) throw new Chyba('REF', `tabulka ${o.nazev} nemá sloupec „${n}“`); return o.c1 + i; };
  let c1 = o.c1, c2 = o.c2;
  if (u.sl1) { c1 = sl(u.sl1); c2 = u.sl2 ? sl(u.sl2) : c1; if (c2 < c1) [c1, c2] = [c2, c1]; }
  const d1 = o.r1 + 1, d2 = o.r2 - (o.souhrn ? 1 : 0);
  switch (u.cast) {
    case 'vse': return { r1: o.r1, c1, r2: o.r2, c2 };
    case 'hd': return { r1: o.r1, c1, r2: Math.max(d1, d2), c2 };
    case 'dt': return { r1: d1, c1, r2: o.r2, c2 };
    case 'hlavicky': return { r1: o.r1, c1, r2: o.r1, c2 };
    case 'souhrny': if (!o.souhrn) throw new Chyba('REF', `tabulka ${o.nazev} nemá řádek souhrnů`); return { r1: o.r2, c1, r2: o.r2, c2 };
    case 'radek':
      if (o.list) throw new Chyba('VALUE', '@ (tento řádek) funguje jen v tabulce na stejném listu');
      if (!kde || kde.r < d1 || kde.r > d2) throw new Chyba('VALUE', '@ (tento řádek) funguje jen ve vzorci v řádku dat tabulky');
      return { r1: kde.r, c1, r2: kde.r, c2 };
    default: return { r1: d1, c1, r2: Math.max(d1, d2), c2 };
  }
}
const platnyNazevTabulky = n => typeof n === 'string' && /^[A-Za-zÀ-ž_][\wÀ-ž.]{0,99}$/.test(n) && !/^[A-Za-z]{1,3}\d+$/.test(n) && !/^(TRUE|FALSE|PRAVDA|NEPRAVDA|R|C)$/i.test(n);

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
      const m = /^#(DIV\/0!|N\/A|NAME\?|VALUE!|REF!|NUM!|DĚLENÍ_NULOU!|NENÍ_K_DISPOZICI|NÁZEV\?|HODNOTA!|ODKAZ!|ČÍSLO!|SPILL!|ROZLITÍ!|CALC!|VÝPOČET!)/i.exec(s.slice(i));
      if (!m) throw chybaSyntaxe('Neznámá chybová hodnota', z);
      const u = m[0].toUpperCase();
      i += m[0].length; t.push({ t: 'err', v: Object.keys(CHYBY).find(k => CHYBY[k].cs === u || CHYBY[k].en === u), s: z, e: i }); continue;
    }
    if (/\d/.test(ch) || ((ch === '.' || (ch === ',' && jazyk !== 'en')) && /\d/.test(s[i + 1] || ''))) {
      const m = (jazyk === 'en' ? /^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/ : /^(\d+([,.]\d*)?|[,.]\d+)([eE][+-]?\d+)?/).exec(s.slice(i));
      i += m[0].length; t.push({ t: 'num', v: parseFloat(m[0].replace(',', '.')), s: z, e: i }); continue;
    }
    if (ch === "'") {
      let v = ''; i++;
      while (i < s.length) { if (s[i] === "'") { if (s[i + 1] === "'") { v += "'"; i += 2; continue; } break; } v += s[i++]; }
      if (s[i] !== "'" || s[i + 1] !== '!') throw chybaSyntaxe('Název listu v apostrofech musí končit ’! (např. \'Můj list\'!A1)', z);
      i += 2; t.push({ t: 'sheet', v, s: z, e: i }); continue;
    }
    if (ch === '[') {   /* [@Sloupec] – strukturovaný odkaz bez názvu tabulky (tabulka, ve které je vzorec) */
      const h = ctiHranate(s, i, tolerantne);
      i = h.konec; t.push({ t: 'tab', tab: null, spec: h.text, s: z, e: i }); continue;
    }
    if (ch === '$' || PISMENO.test(ch)) {
      const slovo = /^[$A-Za-zÀ-ž_][\wÀ-ž.$]*/.exec(s.slice(i))[0];
      i += slovo.length;
      if (s[i] === '[' && !slovo.includes('$')) {   /* Tabulka[Sloupec] */
        const h = ctiHranate(s, i, tolerantne);
        i = h.konec; t.push({ t: 'tab', tab: slovo, spec: h.text, s: z, e: i }); continue;
      }
      if (s[i] === '!' && !slovo.includes('$')) { i++; t.push({ t: 'sheet', v: slovo, s: z, e: i }); continue; }
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
      case 'sheet': {
        const a = dalsi();
        if (!a || a.t !== 'ref') throw chybaSyntaxe(`Za názvem listu „${k.v}“ musí být adresa buňky`, a ? a.s : konec());
        const ra = { ...ref(a), list: k.v, s: k.s };
        if (kon() && kon().t === 'op' && kon().v === ':') {
          dalsi();
          const b = dalsi();
          if (!b || b.t !== 'ref') throw chybaSyntaxe('Za dvojtečkou musí být adresa buňky', b ? b.s : konec());
          return { t: 'range', a: ra, b: { ...ref(b), list: k.v }, s: k.s, e: b.e };
        }
        return ra;
      }
      case 'tab': return { t: 'tab', tab: k.tab, ...rozeberSpec(k.spec, k.s), s: k.s, e: k.e };
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
const textListu = l => /^[A-Za-zÀ-ž_][\wÀ-ž.]*$/.test(l) && !/^[A-Za-z]{1,3}\d+$/.test(l) ? l : "'" + l.replace(/'/g, "''") + "'";
const textRef = (n, sListem = true) => (sListem && n.list ? textListu(n.list) + '!' : '') + (n.absC ? '$' : '') + cisloNaSloupec(n.c) + (n.absR ? '$' : '') + n.r;
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
      case 'range': x = esc(textRef(u.a) + ':' + textRef(u.b, false)); break;
      case 'jmeno': x = esc(u.v); break;
      case 'tab': x = esc(textTab(u, jazyk)); break;
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
/* vložení (pocet > 0) nebo smazání (pocet < 0) řádků/sloupců od indexu od: přepis odkazů jako v Excelu */
function posunIndex(i, od, pocet) {
  if (pocet > 0) return i >= od ? i + pocet : i;
  const k = od - pocet - 1;
  return i < od ? i : i > k ? i + pocet : null;
}
function strukturaStrom(uzel, osa, od, pocet, jeCil = n => !n.list) {
  function k(u) {
    switch (u.t) {
      case 'ref': {
        if (!jeCil(u)) return { ...u };
        const v = posunIndex(u[osa], od, pocet);
        return v === null ? { t: 'err', v: 'REF', s: u.s, e: u.e } : { ...u, [osa]: v };
      }
      case 'range': {
        if (!jeCil(u.a)) return { ...u };
        const lo = Math.min(u.a[osa], u.b[osa]), hi = Math.max(u.a[osa], u.b[osa]);
        let nlo, nhi;
        if (pocet > 0) { nlo = posunIndex(lo, od, pocet); nhi = posunIndex(hi, od, pocet); }
        else {
          const kon = od - pocet - 1;
          nlo = lo >= od && lo <= kon ? od : posunIndex(lo, od, pocet);
          nhi = hi >= od && hi <= kon ? od - 1 : posunIndex(hi, od, pocet);
          if (nlo > nhi) return { t: 'err', v: 'REF', s: u.s, e: u.e };
        }
        const a = { ...u.a }, b = { ...u.b };
        if (u.a[osa] <= u.b[osa]) { a[osa] = nlo; b[osa] = nhi; } else { a[osa] = nhi; b[osa] = nlo; }
        return { ...u, a, b };
      }
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
    case '^': return mocnina(cislo(a), cislo(b));
    case '&': return text(a, jazyk) + text(b, jazyk);
    default: {
      const c = porovnej(a, b);
      return op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
    }
  }
}

/* prvek pole na pozici i, j (pole o jednom řádku/sloupci se roztáhne jako v Excelu); skalár zůstane */
function prvekPole(x, i, j) {
  if (!jePole(x)) return x;
  const r = x.h[x.h.length === 1 ? 0 : i];
  const v = r && r[x.h[0].length === 1 ? 0 : j];
  return v === undefined ? new Chyba('NA', 'pole mají různou velikost') : v;
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
    case 'jmeno': {
      const prom = ctx.promenne && ctx.promenne.get(u.v.toUpperCase());
      if (prom !== undefined) return krok(prom, `proměnná ${u.v} (z funkce LET) = ${L(prom)}`);
      const def = ctx.nazev && ctx.nazev(u.v);
      if (def !== undefined && def !== null) {
        if ((ctx.hloubka || 0) > 20) return krok(new Chyba('CIRC', 'název odkazuje sám na sebe'), `název ${u.v} odkazuje sám na sebe`);
        let st;
        try { st = rozeber(String(def).startsWith('=') ? def : '=' + def, ctx.jazyk); } catch (e) { return krok(new Chyba('NAME'), `definice názvu ${u.v} je chybná: ${e.message}`); }
        const v = vyhodnotUzel(st, { ...ctx, kroky: null, hloubka: (ctx.hloubka || 0) + 1 });
        return krok(v, `název ${u.v} = ${def} → ${L(v)}`);
      }
      const tb = ctx.tabulka && ctx.tabulka(u.v);
      if (tb) return vyhodnotUzel({ t: 'tab', tab: u.v, cast: 'data', s: u.s, e: u.e }, ctx);   /* samotný název tabulky = její data */
      return krok(new Chyba('NAME'), `„${u.v}“ není funkce, adresa, název ani PRAVDA/NEPRAVDA. Je-li to text, patří do uvozovek: "${u.v}"`);
    }
    case 'tab': {
      const o = ctx.tabulka ? ctx.tabulka(u.tab, ctx.kde) : null;
      const txt = textTab(u, ctx.jazyk);
      if (!o) return krok(new Chyba('REF', u.tab ? `tabulka „${u.tab}“ neexistuje` : '[@…] patří do vzorce uvnitř tabulky'), u.tab ? `${txt} → tabulka ${u.tab} v sešitu není` : `${txt} → vzorec není v žádné tabulce`);
      let ob;
      try { ob = oblastTab(u, o, ctx.kde); } catch (e) { if (e instanceof Chyba) return krok(e, `${txt} → ${e.proc}`); throw e; }
      const roh = (r, c) => ({ t: 'ref', r, c, list: o.list });
      const n = ob.r1 === ob.r2 && ob.c1 === ob.c2 ? roh(ob.r1, ob.c1) : { t: 'range', a: roh(ob.r1, ob.c1), b: roh(ob.r2, ob.c2) };
      const v = vyhodnotUzel(n, { ...ctx, kroky: null });
      const co = { vse: 'celá tabulka i se záhlavím', hlavicky: 'řádek záhlaví', souhrny: 'řádek souhrnů', radek: 'tento řádek', data: 'data bez záhlaví' }[u.cast];
      const kde = (o.list ? textListu(o.list) + '!' : '') + adresa(ob.r1, ob.c1) + (n.t === 'range' ? ':' + adresa(ob.r2, ob.c2) : '');
      /* části věty přes I18N.t – překladač stránky vzory s proměnnými jinak nechá česky */
      const tt = x => (koren.I18N && koren.I18N.t ? koren.I18N.t(x) : x), konec = n.t === 'ref' ? ` → ${L(v)}` : '';
      return krok(v, u.sl1 ? `${txt} → sloupec ${u.sl1}${u.sl2 ? '–' + u.sl2 : ''} tabulky ${o.nazev} (${tt(co)}) = ${kde}${konec}` : `${txt} → ${tt(co)} tabulky ${o.nazev} = ${kde}${konec}`);
    }
    case 'ref': {
      const v = ctx.bunka(u.r, u.c, u.list);
      return krok(v, `${textRef(u)} → hodnota buňky ${adresa(u.r, u.c)}${u.list ? ' na listu ' + u.list : ''}${v === null ? ' (prázdná – v počtech se bere jako 0, v textu jako "")' : ''}`);
    }
    case 'range': {
      const r1 = Math.min(u.a.r, u.b.r), r2 = Math.max(u.a.r, u.b.r), c1 = Math.min(u.a.c, u.b.c), c2 = Math.max(u.a.c, u.b.c);
      const h = [];
      for (let r = r1; r <= r2; r++) { const radek = []; for (let c = c1; c <= c2; c++) radek.push(ctx.bunka(r, c, u.a.list)); h.push(radek); }
      return krok({ h, r1, c1, r2, c2, list: u.a.list }, `oblast ${u.a.list ? textListu(u.a.list) + '!' : ''}${adresa(r1, c1)}:${adresa(r2, c2)} → ${r2 - r1 + 1} ${r2 > r1 ? 'řádků' : 'řádek'} × ${c2 - c1 + 1} ${c2 > c1 ? 'sloupců' : 'sloupec'} = ${(r2 - r1 + 1) * (c2 - c1 + 1)} hodnot (∅ = prázdná)`);
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
      const tt = x => (koren.I18N && koren.I18N.t ? koren.I18N.t(x) : x);
      let popis = `${tt(NAZVY_OP[u.op])}: ${L(a)} ${u.op} ${L(b)} → ${L(v)}`;
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
        const pod = vyhodnotUzel(args[0], ctx);
        if (jePole(pod) && pod.h.length * pod.h[0].length > 1) {   /* pole podmínek: KDYŽ pro každý prvek zvlášť */
          const vet = (x, vych) => (!x ? vych : x.t === 'prazdny' ? 0 : vyhodnotUzel(x, ctx));
          const ano = vet(args[1], true), ne = vet(args[2], false);
          const h = pod.h.map((r, i) => r.map((c, j) => {
            const b = zachyt(() => logika(c));
            return jeChyba(b) ? b : prvekPole(b ? ano : ne, i, j);
          }));
          const v = { h, pole: true };
          return krok(v, `${nazev}: podmínka je pole – rozhoduje se pro každý prvek zvlášť → ${L(v)}`);
        }
        const b = zachyt(() => logika(pod));
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
      if (u.en === 'LET') {
        if (args.length % 2 === 0) return krok(new Chyba('VALUE'), `${nazev} potřebuje dvojice název; hodnota a na konci výpočet`);
        const prom = new Map(ctx.promenne || []), jmena = [];
        for (let i = 0; i + 1 < args.length; i += 2) {
          if (args[i].t !== 'jmeno') return krok(new Chyba('VALUE'), `${nazev}: ${i + 1}. argument musí být název proměnné (např. cena)`);
          const v = vyhodnotUzel(args[i + 1], { ...ctx, promenne: prom });
          prom.set(args[i].v.toUpperCase(), v); jmena.push(`${args[i].v} = ${L(v)}`);
        }
        const v = vyhodnotUzel(args[args.length - 1], { ...ctx, promenne: prom });
        return krok(v, `${nazev}: proměnné ${jmena.join(', ')} → výpočet = ${L(v)}`);
      }
      if (u.en === 'IFERROR' || u.en === 'IFNA') {
        const v = vyhodnotUzel(args[0], ctx);
        const zachytit = x => jeChyba(x) && (u.en === 'IFERROR' || x.kod === 'NA');
        if (jePole(v) && v.h.length * v.h[0].length > 1) {   /* pole: chyby se nahradí po prvcích */
          if (!v.h.some(r => r.some(zachytit))) return krok(v, `${nazev}: v poli není žádná chyba → vrací ho beze změny`);
          const n = args[1].t === 'prazdny' ? 0 : vyhodnotUzel(args[1], ctx);
          const w = { h: v.h.map((r, i) => r.map((x, j) => (zachytit(x) ? prvekPole(n, i, j) : x))), pole: true };
          return krok(w, `${nazev}: chybné prvky pole nahradí ${L(n)} → ${L(w)}`);
        }
        const sv = jePole(v) ? v.h[0][0] : v;
        if (jeChyba(sv) && (u.en === 'IFERROR' || sv.kod === 'NA')) {
          const n = args[1].t === 'prazdny' ? 0 : vyhodnotUzel(args[1], ctx);
          return krok(n, `${nazev}: 1. argument je chyba ${L(sv)} → vrací náhradu ${L(n)}`);
        }
        return krok(v, `${nazev}: 1. argument ${jeChyba(sv) ? 'je jiná chyba než #NENÍ_K_DISPOZICI' : 'není chyba'} → vrací ho beze změny`);
      }
      const hodn = args.map(x => (x.t === 'prazdny' ? null : vyhodnotUzel(x, ctx)));
      hodn.zOdkazu = args.map(x => { while (x.t === 'zav') x = x.x; return x.t === 'ref' || x.t === 'tab' || x.t === 'jmeno'; });
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

let SONDA = 0, KONTAMINACE = false;   /* zkušební výpočty při hledání zdroje rozlití */
/* ---------- formáty buněk ----------
   formát = { t: 'obecny'|'cislo'|'mena'|'proc'|'datum'|'text', d: desetinná místa, tis: oddělovač tisíců, b: tučné, z: 'l'|'c'|'r' } */
function normFormat(f) {
  if (!f) return null;
  if (typeof f === 'object') return f;
  return { '%': { t: 'proc' }, kc: { t: 'mena', d: 2, tis: true }, datum: { t: 'datum' }, '0,00': { t: 'cislo', d: 2 } }[f] || null;
}
const vzorFormatu = (d, tis, jazyk = 'cs') => jazyk === 'en' ? (tis ? '#,##0' : '0') + (d > 0 ? '.' + '0'.repeat(d) : '') : (tis ? '# ##0' : '0') + (d > 0 ? ',' + '0'.repeat(d) : '');

/* ---------- řady pro úchyt: 1, 2 → 3, 4…; datum +1; „Položka 1“ → „Položka 2“; dny a měsíce ---------- */
const SEZNAMY = [
  DNY.slice(1).concat(DNY[0]), ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'], MESICE,
  ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'],
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
];
function pokracujRadu(zdroj, n, jazyk = 'cs') {
  const k = zdroj.length, krok = (a, b) => (k > 1 ? (b - a) / (k - 1) : 1);
  const kopie = () => Array.from({ length: n }, (_, i) => zdroj[i % k]);
  if (!k || zdroj.some(x => x === '' || x.startsWith('=') || x.includes('%'))) return kopie();
  const dat = zdroj.map(textNaDatum);
  if (dat.every(x => x !== null)) {
    const st = krok(dat[0], dat[k - 1]);
    return Array.from({ length: n }, (_, i) => fmtDatum(dat[k - 1] + st * (i + 1)));
  }
  const cis = zdroj.map(textNaCislo);
  if (cis.every(x => x !== null)) {
    if (k === 1) return kopie();
    const st = krok(cis[0], cis[k - 1]);
    return Array.from({ length: n }, (_, i) => fmtCislo(Number((cis[k - 1] + st * (i + 1)).toPrecision(15)), jazyk));
  }
  for (const sez of SEZNAMY) {
    const idx = zdroj.map(x => sez.indexOf(x.trim().toLowerCase()));
    if (idx.some(i => i < 0)) continue;
    const st = Math.round(krok(idx[0], idx[k - 1])) || 1, velke = /^\p{Lu}/u.test(zdroj[0]), vse = zdroj[0] === zdroj[0].toUpperCase();
    return Array.from({ length: n }, (_, i) => {
      const t = sez[(((idx[k - 1] + st * (i + 1)) % sez.length) + sez.length) % sez.length];
      return vse && zdroj[0].length > 1 ? t.toUpperCase() : velke ? t[0].toUpperCase() + t.slice(1) : t;
    });
  }
  const m = zdroj.map(x => /^(.*?)(\d+)$/s.exec(x));
  if (m.every(x => x && x[1] === m[0][1] && x[1] !== '')) {
    const c = m.map(x => +x[2]), st = Math.round(krok(c[0], c[k - 1])) || 1, del = m[k - 1][2].length;
    return Array.from({ length: n }, (_, i) => m[0][1] + String(Math.max(0, c[k - 1] + st * (i + 1))).padStart(m[k - 1][2].startsWith('0') ? del : 1, '0'));
  }
  return kopie();
}

/* odkazy ve stromu jako obdélníky {r1, c1, r2, c2} (pro audit) */
function odkazyStromu(strom, tabulka) {
  const out = [], lety = tabulka ? letNazvy(strom) : null;
  (function p(u) {
    if (!u) return;
    if (tabulka && (u.t === 'tab' || (u.t === 'jmeno' && !lety.has(u.v.toUpperCase())))) { const o = tabulka(u.t === 'jmeno' ? { t: 'tab', tab: u.v, cast: 'data' } : u); if (o) out.push(o); }
    if (u.t === 'ref') out.push({ r1: u.r, c1: u.c, r2: u.r, c2: u.c, list: u.list });
    else if (u.t === 'range') out.push({ r1: Math.min(u.a.r, u.b.r), c1: Math.min(u.a.c, u.b.c), r2: Math.max(u.a.r, u.b.r), c2: Math.max(u.a.c, u.b.c), list: u.a.list });
    (u.args || []).forEach(p); p(u.l); p(u.r); p(u.x);
  })(strom);
  return out;
}
const vObdelniku = (o, r, c) => r >= o.r1 && r <= o.r2 && c >= o.c1 && c <= o.c2;

/* vzorec v relativním tvaru (jako R1C1): stejný tvar = stejný vzorec zkopírovaný jinam; nezávisí na vzdálenosti od A1 */
function tvarR1C1(s, p, jazyk) {
  try {
    const st = rozeber(s, jazyk);
    return JSON.stringify(st, (k, v) => {
      if (k === 's' || k === 'e') return undefined;
      if (v && v.t === 'ref') return { t: 'ref', r: v.absR ? 'R' + v.r : 'R[' + (v.r - p.r) + ']', c: v.absC ? 'C' + v.c : 'C[' + (v.c - p.c) + ']', list: v.list };
      return v;
    });
  } catch (e) { return s; }
}
/* názvy, které ve vzorci definuje LET (nejsou to tabulky ani definované názvy) */
function letNazvy(strom) {
  const n = new Set();
  (function p(u) { if (!u) return; if (u.t === 'fn' && u.en === 'LET') for (let i = 0; i + 1 < u.args.length; i += 2) if (u.args[i].t === 'jmeno') n.add(u.args[i].v.toUpperCase()); (u.args || []).forEach(p); p(u.l); p(u.r); p(u.x); })(strom);
  return n;
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
  zneplatni() { if (this.sesit) this.sesit.zneplatni(); else this.cache = new Map(); }
  kontext(kroky, a) {
    return {
      jazyk: this.jazyk, kroky,
      kde: a ? rozeberAdresu(a) : null,
      tabulka: (jm, kde) => this.najdiTabulku(jm, kde),
      bunka: (r, c, l) => {
        /* buňka, ze které se rozlévá pole, se jako jednotlivá buňka chová jako jeho první prvek */
        const prvni = v => (jePole(v) && v.rozlitiZ ? v.h[0][0] : v);
        if (!l || (this.nazev && l.toUpperCase() === this.nazev.toUpperCase())) return prvni(this.hodnota(adresa(r, c)));
        const jiny = this.sesit && this.sesit.list(l);
        return jiny ? prvni(jiny.hodnota(adresa(r, c))) : new Chyba('REF', `list „${l}“ neexistuje`);
      },
      nazev: jm => this.sesit ? this.sesit.nazvy[jm.toUpperCase()] : undefined,
    };
  }
  nastav(a, v) {
    a = a.toUpperCase();
    if (v && typeof v === 'object') { if (v.f) this.format[a] = normFormat(v.f); v = v.v ?? ''; }
    v = v === null || v === undefined ? '' : String(v);
    if (v === '') delete this.bunky[a]; else this.bunky[a] = v;
    /* „50%“ zapsané do buňky: Excel buňce sám nastaví procentní formát */
    if (!this.format[a] && /^\s*[+-]?\d[\d\s.,]*\s?%\s*$/.test(v)) this.format[a] = { t: 'proc' };
    this.zneplatni();
    const p = rozeberAdresu(a);
    if (p) { this.radku = Math.max(this.radku, p.r); this.sloupcu = Math.max(this.sloupcu, p.c); }
  }
  surova(a) { return this.bunky[a.toUpperCase()] ?? ''; }
  /* tabulka podle názvu (i na jiném listu sešitu), bez názvu ta, ve které leží buňka kde */
  najdiTabulku(jm, kde) {
    const popis = (t, l) => {
      const sloupce = [];
      for (let c = t.c1; c <= t.c2; c++) {
        /* název sloupce = zapsaný text záhlaví (nezávisí na jazyce ani formátu); vzorec v záhlaví → jeho výsledek, chyba → SloupecN */
        const raw = l.surova(adresa(t.r1, c));
        let n = raw.startsWith('=') ? null : raw.replace(/^'/, '');
        if (n === null) { try { const v = l.hodnota(adresa(t.r1, c)); const w = jePole(v) ? v.h[0][0] : v; n = jeChyba(w) || w === null || w === undefined ? '' : text(w, l.jazyk); } catch (e) { n = ''; } }
        sloupce.push(n === '' ? 'Sloupec' + (c - t.c1 + 1) : n);
      }
      return { ...t, sloupce, list: l === this ? undefined : l.nazev };
    };
    if (!jm) { const t = kde && (this.tabulky || []).find(x => vObdelniku(x, kde.r, kde.c)); return t ? popis(t, this) : null; }
    const N = String(jm).toUpperCase();
    for (const l of [this, ...(this.sesit ? this.sesit.listy.filter(x => x !== this) : [])]) {
      const t = (l.tabulky || []).find(x => x.nazev.toUpperCase() === N);
      if (t) return popis(t, l);
    }
    return null;
  }
  vsechnyTabulky() { return this.sesit ? this.sesit.listy.flatMap(l => l.tabulky || []) : this.tabulky || []; }
  /* oblast strukturovaného odkazu (uzel 'tab') pro buňku a – pro barevné rámečky a audit; jiný list → null */
  oblastOdkazu(u, a) {
    const o = this.najdiTabulku(u.tab, a ? rozeberAdresu(a) : null);
    if (!o || o.list) return null;
    try { return oblastTab(u, o, a ? rozeberAdresu(a) : null); } catch (e) { return null; }
  }
  konstanta(s) {
    if (s.startsWith("'")) return s.slice(1);
    const n = textNaCislo(s, this.jazyk); if (n !== null) return n;
    const d = textNaDatum(s); if (d !== null) return d;
    const u = s.trim().toUpperCase();
    if (u === 'PRAVDA' || u === 'TRUE') return true;
    if (u === 'NEPRAVDA' || u === 'FALSE') return false;
    return s;
  }
  hodnota(a, kroky = null) {
    a = a.toUpperCase();
    if (!kroky && this.cache.has(a)) return this.cache.get(a);
    JAZYK_VYPOCTU = this.jazyk;
    const s = this.surova(a);
    let v;
    if (!s) v = this.rozliti(a).v;
    else if (this.format[a]?.t === 'text') v = s.startsWith("'") ? s.slice(1) : s;   /* formát Text: ani vzorec se nepočítá */
    else if (!s.startsWith('=')) v = this.konstanta(s);
    else {
      const pocita = this.sesit ? this.sesit.pocita : this.pocita, klic = (this.nazev || '') + '!' + a;
      if (pocita.has(klic)) { if (SONDA > 0) KONTAMINACE = true; return new Chyba('CIRC', `buňka ${a} (i oklikou) odkazuje sama na sebe`); }
      pocita.add(klic);
      try {
        v = vyhodnotUzel(rozeber(s, this.jazyk), this.kontext(kroky, a));
      } catch (e) {
        if (e instanceof Chyba) v = e;
        else if (e.syntaxe) v = new Chyba('NAME', 'chyba zápisu: ' + e.message);
        else throw e;
      } finally { pocita.delete(klic); }
      if (v === null || v === undefined) v = 0;   /* vzorec odkazující na prázdnou buňku ukáže 0 */
      if (jePole(v) && !kroky) v = this.rozlij(a, v);
    }
    if (!kroky) this.cache.set(a, v);
    return v;
  }
  /* vyhodnotí libovolný vzorec v kontextu listu (bez záznamu kroků) */
  vyhodnot(vzorec) {
    try { const v = vyhodnotUzel(rozeber(vzorec, this.jazyk), this.kontext(null)); return jePole(v) ? v.h[0][0] : v; }
    catch (e) { return e instanceof Chyba ? e : new Chyba('NAME', e.message); }
  }
  /* podmíněné formátování: Map adresa → {styl, pruh (0–1), skala (0–1), pravidla[]} */
  podmineneStyly() {
    const out = new Map();
    const pridej = (a, x, i) => { const s = out.get(a) || { pravidla: [] }; Object.assign(s, x); s.pravidla.push(i); out.set(a, s); };
    (this.pravidla || []).forEach((p, i) => {
      let o;
      try { const st = rozeber('=' + p.oblast, this.jazyk); o = st.t === 'range' ? { r1: Math.min(st.a.r, st.b.r), c1: Math.min(st.a.c, st.b.c), r2: Math.max(st.a.r, st.b.r), c2: Math.max(st.a.c, st.b.c) } : st.t === 'ref' ? { r1: st.r, c1: st.c, r2: st.r, c2: st.c } : null; } catch (e) { o = null; }
      if (!o) return;
      const adr = [];
      for (let r = o.r1; r <= o.r2 && adr.length < 5000; r++) for (let c = o.c1; c <= o.c2; c++) adr.push([adresa(r, c), r, c]);
      const hod = a => { let v = this.hodnota(a); if (jePole(v)) v = v.h[0][0]; return v; };
      const prah = x => { const t = String(x ?? '').trim(); if (t.startsWith('=')) return this.vyhodnot(t); return t === '' ? null : this.konstanta(t); };
      const cisla = adr.map(([a]) => hod(a)).filter(v => typeof v === 'number');
      const min = Math.min(...cisla), max = Math.max(...cisla);
      const h1 = prah(p.h1), h2 = prah(p.h2);
      if (p.typ === 'pruh' || p.typ === 'skala') {
        if (!cisla.length) return;
        const lo = p.typ === 'pruh' ? Math.min(0, min) : min, rozp = (max - lo) || 1;
        adr.forEach(([a]) => { const v = hod(a); if (typeof v === 'number') pridej(a, { [p.typ]: (v - lo) / rozp }, i); });
        return;
      }
      let test;
      switch (p.typ) {
        case 'vetsi': test = v => v !== null && porovnej(v, h1) > 0; break;
        case 'mensi': test = v => v !== null && porovnej(v, h1) < 0; break;
        case 'mezi': test = v => v !== null && porovnej(v, h1) >= 0 && porovnej(v, h2) <= 0; break;
        case 'rovno': test = v => v !== null && porovnej(v, h1) === 0; break;
        case 'obsahuje': test = v => v !== null && String(text(v, this.jazyk)).toLowerCase().includes(String(h1 ?? '').toLowerCase()); break;
        case 'nadprumer': { const m = cisla.reduce((x, y) => x + y, 0) / (cisla.length || 1); test = v => typeof v === 'number' && v > m; break; }
        case 'top': { const n = Math.max(1, Math.trunc(Number(h1) || 3)), hr = [...cisla].sort((x, y) => y - x)[Math.min(n, cisla.length) - 1]; test = v => typeof v === 'number' && v >= hr; break; }
        case 'duplicita': { const pocty = new Map(); adr.forEach(([a]) => { const v = hod(a); if (v !== null) { const k = String(v).toLowerCase(); pocty.set(k, (pocty.get(k) || 0) + 1); } }); test = v => v !== null && pocty.get(String(v).toLowerCase()) > 1; break; }
        case 'vzorec': {
          const vz = String(p.h1 || '').startsWith('=') ? p.h1 : '=' + p.h1;
          adr.forEach(([a, r, c]) => { let x; try { x = this.vyhodnot(posunVzorec(vz, r - o.r1, c - o.c1, this.jazyk)); } catch (e) { x = false; } let ok = false; try { ok = !jeChyba(x) && logika(x); } catch (e) { ok = false; } if (ok) pridej(a, { styl: p.styl }, i); });
          return;
        }
        default: return;
      }
      adr.forEach(([a]) => { const v = hod(a); if (!jeChyba(v) && test(v)) pridej(a, { styl: p.styl }, i); });
    });
    return out;
  }
  /* dynamické pole: výsledek s víc hodnotami se rozlije doprava a dolů, pokud je kam */
  rozlij(a, v) {
    const R = v.h.length, C = v.h[0] ? v.h[0].length : 0;
    if (R * C <= 1) return v;
    if (R * C > 5000) return new Chyba('SPILL', `pole ${R} × ${C} je na rozlití příliš velké`);
    const p = rozeberAdresu(a);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      if (!i && !j) continue;
      const b = adresa(p.r + i, p.c + j);
      if (this.surova(b) !== '') return new Chyba('SPILL', `výsledek ${R} × ${C} se nemá kam rozlít – buňka ${b} není prázdná`);
    }
    return { ...v, h: v.h.map(r => r.map(x => (x === null || x === undefined ? 0 : x))), rozlitiZ: a };
  }
  /* může vzorec vrátit pole? (oblast, funkce dynamických polí, název) – jen takové se zkoumají jako zdroj rozlití */
  mozneRozliti(raw) {
    if (/:|FILTR|FILTER|SEŘADIT|SORT|UNIKÁTNÍ|UNIQUE|POSLOUPNOST|SEQUENCE|INDEX|IFERROR|IFNA|KDYŽ|IF\(/i.test(raw)) return true;
    if (raw.includes('[')) return true;   /* Tabulka[Sloupec] = oblast */
    const n = [...(this.sesit ? Object.keys(this.sesit.nazvy) : []), ...this.vsechnyTabulky().map(t => t.nazev.toUpperCase())];
    const u = raw.toUpperCase();
    return n.some(x => u.includes(x));
  }
  /* hodnota prázdné buňky, do které se rozlilo pole z jiné buňky: {v, zdroj} */
  rozliti(a) {
    const p = rozeberAdresu(a), pocita = this.sesit ? this.sesit.pocita : this.pocita;
    for (const [b, raw] of Object.entries(this.bunky)) {
      if (!raw.startsWith('=')) continue;
      const q = rozeberAdresu(b);
      if (q.r > p.r || q.c > p.c || !this.mozneRozliti(raw) || pocita.has((this.nazev || '') + '!' + b)) continue;
      let v;
      if (this.cache.has(b)) v = this.cache.get(b);
      else {
        /* zkušební výpočet: když narazí na rozpracovanou buňku (falešný cyklus), nic z něj se neuloží */
        const pred = this.cache.size, k0 = KONTAMINACE;
        SONDA++; KONTAMINACE = false;
        try { v = this.hodnota(b); } finally { SONDA--; }
        const vadne = KONTAMINACE; KONTAMINACE = k0 || (SONDA > 0 && vadne);
        if (vadne) { [...this.cache.keys()].slice(pred).forEach(x => this.cache.delete(x)); continue; }
      }
      if (jePole(v) && v.rozlitiZ) {
        const i = p.r - q.r, j = p.c - q.c;
        if (i < v.h.length && j < v.h[0].length) { const x = v.h[i][j]; return { v: x === undefined ? null : x, zdroj: b }; }
      }
    }
    return { v: null, zdroj: null };
  }
  /* kroky vyhodnocení vzorce (v kontextu listu) */
  kroky(vzorec, a) {
    const strom = rozeber(vzorec, this.jazyk), kroky = [];
    let v;
    try { v = vyhodnotUzel(strom, this.kontext(kroky, a)); }
    catch (e) { if (e instanceof Chyba) v = e; else throw e; }
    return { strom, kroky, vysledek: v };
  }
  jeDatum(a, hloubka = 0) {
    a = a.toUpperCase();
    const f = this.format[a];
    if (f && f.t && f.t !== 'obecny') return f.t === 'datum';
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
      const f = this.format[a.toUpperCase()] || {};
      switch (f.t) {
        case 'cislo': return formatujText(v, vzorFormatu(f.d ?? 2, f.tis, this.jazyk), this.jazyk);
        case 'mena': return formatujText(v, vzorFormatu(f.d ?? 2, f.tis ?? true, this.jazyk), this.jazyk) + ' Kč';
        case 'proc': return (f.d === undefined ? fmtCislo(zaokr(v * 100, 2), this.jazyk) : formatujText(v * 100, vzorFormatu(f.d, false, this.jazyk), this.jazyk)) + ' %';
        case 'datum': return fmtDatum(v);
      }
      if (this.jeDatum(a)) return fmtDatum(v);
      if (f.d !== undefined || f.tis) return formatujText(v, vzorFormatu(f.d ?? 0, f.tis, this.jazyk), this.jazyk);
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
  /* ---------- audit ---------- */
  /* předchůdci: oblasti, na které vzorec v buňce přímo odkazuje */
  predchudci(a) {
    a = a.toUpperCase();
    const s = this.surova(a);
    if (!s.startsWith('=') || this.format[a]?.t === 'text') return [];
    try { return odkazyStromu(rozeber(s, this.jazyk), u => this.oblastOdkazu(u, a)); } catch (e) { return []; }
  }
  /* následníci: buňky, jejichž vzorec přímo odkazuje na buňku a */
  naslednici(a) {
    const p = rozeberAdresu(a);
    const muj = o => !o.list || (this.nazev && o.list.toUpperCase() === this.nazev.toUpperCase());
    return Object.keys(this.bunky).filter(b => b !== a.toUpperCase() && this.predchudci(b).some(o => muj(o) && vObdelniku(o, p.r, p.c)))
      .sort((x, y) => { const q = rozeberAdresu(x), w = rozeberAdresu(y); return q.r - w.r || q.c - w.c; });
  }
  /* odkud se chyba v buňce vzala: řetěz [{adresa, kod, popis}] až k buňce, kde vznikla */
  puvodChyby(a, hloubka = 0) {
    a = a.toUpperCase();
    let v = this.hodnota(a);
    if (jePole(v)) v = v.h.flat().find(jeChyba) || v.h[0][0];
    if (!jeChyba(v)) return [];
    const s = this.surova(a);
    if (v.kod === 'CIRC' || hloubka > 30 || !s.startsWith('=')) return [{ adresa: a, kod: v.kod, popis: v.proc || CHYBY[v.kod].popis }];
    let k;
    try { k = this.kroky(s); } catch (e) { return [{ adresa: a, kod: v.kod, popis: 'chyba zápisu: ' + e.message }]; }
    const krok = k.kroky.find(x => jeChyba(x.hodnota) || (jePole(x.hodnota) && x.hodnota.h.flat().some(jeChyba)));
    if (!krok) return [{ adresa: a, kod: v.kod, popis: v.proc || CHYBY[v.kod].popis }];
    let dalsi = null;
    if ((krok.uzel.t === 'ref' && krok.uzel.list) || (krok.uzel.t === 'range' && krok.uzel.a.list)) {
      const u = krok.uzel.t === 'ref' ? krok.uzel : krok.uzel.a;
      return [{ adresa: a, kod: v.kod, popis: `chybu převzala z listu ${u.list} (${textRef(u, false)})` }];
    }
    if (krok.uzel.t === 'ref') dalsi = adresa(krok.uzel.r, krok.uzel.c);
    else if (krok.uzel.t === 'range') {
      const h = krok.hodnota;
      outer: for (let r = 0; r < h.h.length; r++) for (let c = 0; c < h.h[r].length; c++) if (jeChyba(h.h[r][c])) { dalsi = adresa(h.r1 + r, h.c1 + c); break outer; }
    }
    if (dalsi && dalsi !== a) return [{ adresa: a, kod: v.kod, popis: `chybu převzala z buňky ${dalsi}` }].concat(this.puvodChyby(dalsi, hloubka + 1));
    return [{ adresa: a, kod: v.kod, popis: krok.popis }];
  }
  /* kontrola celého listu: chyby, nekonzistentní vzorce ve sloupci, vzorce ve formátu Text */
  kontrola() {
    const nalezy = [], vzorce = {};
    const norm = (a) => {
      const s = this.surova(a), p = rozeberAdresu(a);
      if (!s.startsWith('=')) return null;
      if (!(a in vzorce)) vzorce[a] = tvarR1C1(s, p, this.jazyk);
      return vzorce[a];
    };
    for (const a of Object.keys(this.bunky)) {
      const s = this.surova(a), p = rozeberAdresu(a);
      if (!p) continue;
      if (s.startsWith('=') && this.format[a]?.t === 'text') { nalezy.push({ adresa: a, typ: 'text', text: 'Vzorec je v buňce s formátem Text, proto se nepočítá a zobrazuje se jako text.' }); continue; }
      let v = this.hodnota(a);
      if (jePole(v)) v = v.h[0][0];
      if (jeChyba(v)) {
        const puvod = this.puvodChyby(a);
        nalezy.push({ adresa: a, typ: 'chyba', kod: v.kod, text: puvod[puvod.length - 1]?.popis || CHYBY[v.kod].popis, puvod });
        continue;
      }
      const ja = norm(a);
      if (ja) {
        const nad = adresa(p.r - 1, p.c), pod = adresa(p.r + 1, p.c);
        const n1 = p.r > 1 ? norm(nad) : null, n2 = norm(pod);
        if (n1 && n1 === n2 && n1 !== ja) nalezy.push({ adresa: a, typ: 'nekonzistentni', text: `Vzorec se liší od vzorců nad a pod ním (${nad}: ${this.surova(nad)}). Nebyl přepsán omylem?` });
      }
    }
    return nalezy.sort((x, y) => { const q = rozeberAdresu(x.adresa), w = rozeberAdresu(y.adresa); return q.r - w.r || q.c - w.c; });
  }
  /* Hledat řešení (Goal Seek): jakou hodnotu dát do buňky zmena, aby vzorec v cil vrátil cilova.
     Sečny + půlení intervalu, jakmile se najde změna znaménka. Vrací { ok, x, kroky[{x, v}], duvod }. */
  hledejReseni(cil, cilova, zmena, max = 100) {
    cil = cil.toUpperCase(); zmena = zmena.toUpperCase();
    const puv = this.surova(zmena);
    if (!this.surova(cil).startsWith('=')) return { ok: false, kroky: [], duvod: `V buňce ${cil} musí být vzorec.` };
    if (puv.startsWith('=')) return { ok: false, kroky: [], duvod: `Měněná buňka ${zmena} nesmí obsahovat vzorec – musí v ní být číslo.` };
    if (this.format[cil]?.t === 'text') return { ok: false, kroky: [], duvod: `Buňka ${cil} má formát Text – vzorec v ní se nepočítá.` };
    const start = puv === '' ? 0 : textNaCislo(puv, this.jazyk) ?? textNaDatum(puv);   /* datum = pořadové číslo dne */
    if (start === null) return { ok: false, kroky: [], duvod: `V měněné buňce ${zmena} není číslo.` };
    const zapis = x => { const t = String(+x.toPrecision(15)); this.nastav(zmena, this.jazyk === 'en' ? t : t.replace('.', ',')); };
    const kroky = [], tol = 1e-7 * Math.max(1, Math.abs(cilova));
    const MAX_POKUSU = 160, konecCasu = Date.now() + 2500;   /* jako Excel: omezený počet pokusů, stránka nesmí zamrznout */
    const f = x => { if (kroky.length >= MAX_POKUSU || Date.now() > konecCasu) return NaN; zapis(x); let v = this.hodnota(cil); if (jePole(v)) v = v.h[0][0]; const r = typeof v === 'number' && isFinite(v) ? v - cilova : NaN; kroky.push({ x, v: isNaN(r) ? (jeChyba(v) ? v : null) : r + cilova }); return r; };
    let x0 = start, f0 = f(x0);
    if (Math.abs(f0) <= tol) return { ok: true, x: x0, kroky };
    let x1 = x0 === 0 ? 1 : x0 * 1.1, f1 = f(x1), lo = null, hi = null;
    if (!isNaN(f0) && !isNaN(f1) && f0 === f1) {   /* plochý průběh: zkusit vzdálenější body, jinak cíl na buňce nezávisí */
      for (const k of [0.37, -0.37, 10, -10, 1000, -1000, 2 ** 30, -(2 ** 30), 2 ** 60, -(2 ** 60)]) { x1 = x0 + (x0 || 1) * k; f1 = f(x1); if (isNaN(f1) || f1 !== f0) break; }
      if (f1 === f0) { this.nastav(zmena, puv); return { ok: false, kroky, duvod: `Změnou ${zmena} se výsledek v ${cil} nepodařilo pohnout – vzorec na této buňce nejspíš nezávisí.` }; }
    }
    for (let i = 0; i < max; i++) {
      if (!isNaN(f0) && !isNaN(f1) && Math.sign(f0) !== Math.sign(f1)) { lo = Math.min(x0, x1) === x0 ? [x0, f0] : [x1, f1]; hi = lo[0] === x0 ? [x1, f1] : [x0, f0]; }
      if (!isNaN(f1) && Math.abs(f1) <= tol) return { ok: true, x: x1, kroky };
      let x2;
      if (isNaN(f1)) x2 = (x0 + x1) / 2;
      else if (f1 === f0) x2 = x1 + (x1 - x0) * 2;
      else x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
      if (lo && hi && !(x2 > Math.min(lo[0], hi[0]) && x2 < Math.max(lo[0], hi[0]))) x2 = (lo[0] + hi[0]) / 2;   /* sečna utekla z intervalu → půlení */
      if (!isFinite(x2)) break;
      x0 = x1; f0 = f1; x1 = x2; f1 = f(x1);
      if (lo && hi && !isNaN(f1)) { if (Math.sign(f1) === Math.sign(lo[1])) lo = [x1, f1]; else hi = [x1, f1]; x0 = lo[0]; f0 = lo[1]; }
    }
    /* sečny selhaly (třeba přeskočily nespojitost): body kolem odhadu na obě strany, změna znaménka → půlení */
    const m = Math.abs(start) || 1, body = [start];
    for (let k = -12; k <= 20; k++) { const d = m * Math.pow(2, k); body.push(start + d, start - d, d, -d); }
    body.sort((a, b) => Math.abs(a - start) - Math.abs(b - start));
    const hod = body.map(x => [x, f(x)]).filter(([, v]) => !isNaN(v));
    const zn = hod.find(([, v]) => Math.abs(v) <= tol);
    if (zn) { zapis(zn[0]); return { ok: true, x: zn[0], kroky }; }
    hod.sort((a, b) => a[0] - b[0]);
    let par = null;
    for (let i = 1; i < hod.length; i++) if (Math.sign(hod[i][1]) !== Math.sign(hod[i - 1][1]) && (!par || Math.abs((hod[i][0] + hod[i - 1][0]) / 2 - start) < Math.abs((par[0][0] + par[1][0]) / 2 - start))) par = [hod[i - 1], hod[i]];
    if (par) {
      let [a, b] = par;
      for (let i = 0; i < 200; i++) {
        const x = (a[0] + b[0]) / 2, v = f(x);
        if (isNaN(v)) break;
        if (Math.abs(v) <= tol) return { ok: true, x, kroky };
        if (Math.sign(v) === Math.sign(a[1])) a = [x, v]; else b = [x, v];
      }
    }
    this.nastav(zmena, puv);
    return { ok: false, kroky, duvod: 'Řešení se nenašlo – možná neexistuje, nebo je daleko od výchozí hodnoty. Zkuste do měněné buňky dát jiný odhad.' };
  }
  /* mapa vzorců: adresa → popisek | cislo | vstup | vzorec | natvrdo | nekonz | chyba (jako „Inquire“ v Excelu) */
  mapaVzorcu() {
    /* výsledek se drží do další změny listu (cache hodnot se při změně vymění) */
    if (this._mapa && this._mapa.cache === this.cache) return this._mapa.data;
    const out = new Map(), vstupy = new Set(), vzorce = {}, obdelniky = new Set();
    const norm = a => {
      if (!(a in vzorce)) {
        const s = this.surova(a), p = rozeberAdresu(a);
        vzorce[a] = !s.startsWith('=') || !p ? null : tvarR1C1(s, p, this.jazyk);
      }
      return vzorce[a];
    };
    const adr = Object.keys(this.bunky).filter(a => rozeberAdresu(a));
    const muj = o => !o.list || (this.nazev && o.list.toUpperCase() === this.nazev.toUpperCase());
    const pridej = o => { const k = `${o.r1},${o.c1},${o.r2},${o.c2}`; if (!obdelniky.has(k)) obdelniky.add(k); };
    for (const a of adr) if (this.surova(a).startsWith('=')) for (const o of this.predchudci(a)) if (muj(o)) pridej(o);
    /* i vzorce z ostatních listů, které sem odkazují (List1!A1) */
    if (this.sesit) for (const l of this.sesit.listy) if (l !== this) for (const a of Object.keys(l.bunky)) if (l.surova(a).startsWith('=') && l.surova(a).includes('!'))
      for (const o of l.predchudci(a)) if (o.list && this.nazev && o.list.toUpperCase() === this.nazev.toUpperCase()) pridej(o);
    for (const k of obdelniky) {
      const [r1, c1, r2, c2] = k.split(',').map(Number);
      for (let r = r1; r <= Math.min(r2, r1 + 2000); r++) for (let c = c1; c <= Math.min(c2, c1 + 200); c++) vstupy.add(adresa(r, c));
    }
    const BEZNA = [0, 1, 2, 10, 100, 1000, 12, 24, 60, 7, 365, 0.5];
    const natvrdo = s => { try { let n = false; (function p(u) { if (!u || n) return; if (u.t === 'num' && !BEZNA.includes(u.v)) n = true; (u.args || []).forEach(p); p(u.l); p(u.r); p(u.x); })(rozeber(s, this.jazyk)); return n; } catch (e) { return false; } };
    for (const a of adr) {
      const s = this.surova(a), p = rozeberAdresu(a);
      let v = this.hodnota(a); if (jePole(v)) v = v.h[0][0];
      if (!s.startsWith('=') || this.format[a]?.t === 'text') {
        out.set(a, vstupy.has(a) ? 'vstup' : typeof v === 'number' || typeof v === 'boolean' ? 'cislo' : 'popisek');
        continue;
      }
      if (jeChyba(v)) { out.set(a, 'chyba'); continue; }
      const ja = norm(a), sous = (dr, dc) => (p.r + dr >= 1 && p.c + dc >= 1 ? norm(adresa(p.r + dr, p.c + dc)) : null);
      const [n, d, l, r] = [sous(-1, 0), sous(1, 0), sous(0, -1), sous(0, 1)];
      if ((n && n === d && n !== ja) || (l && l === r && l !== ja)) { out.set(a, 'nekonz'); continue; }
      out.set(a, natvrdo(s) ? 'natvrdo' : 'vzorec');
    }
    this._mapa = { cache: this.cache, data: out };
    return out;
  }
  /* ---------- struktura, řazení, hledání ---------- */
  zmenStrukturu(osa, od, pocet) {
    const nove = {}, nf = {};
    for (const [a, raw] of Object.entries(this.bunky)) {
      const p = rozeberAdresu(a), ni = posunIndex(p[osa], od, pocet);
      if (ni === null) continue;
      const na = osa === 'r' ? adresa(ni, p.c) : adresa(p.r, ni);
      let x = raw;
      const muj = n => !n.list || (this.nazev && n.list.toUpperCase() === this.nazev.toUpperCase());
      if (raw.startsWith('=')) { try { x = '=' + vykresli(strukturaStrom(rozeber(raw, this.jazyk), osa, od, pocet, muj), { jazyk: this.jazyk }); } catch (e) { /* chybný vzorec beze změny */ } }
      nove[na] = x;
      if (this.format[a]) nf[na] = this.format[a];
    }
    this.bunky = nove; this.format = nf;
    if (osa === 'c' && this.sirky) {
      const s = {};
      for (const [c, w] of Object.entries(this.sirky)) { const n = posunIndex(+c, od, pocet); if (n !== null) s[n] = w; }
      this.sirky = s;
    }
    if (this.kukatko) this.kukatko = this.kukatko.map(a => { const p = rozeberAdresu(a), n = posunIndex(p[osa], od, pocet); return n === null ? null : osa === 'r' ? adresa(n, p.c) : adresa(p.r, n); }).filter(Boolean);
    if (this.pravidla) this.pravidla = this.pravidla.map(p => {
      try {
        const o = '=' + vykresli(strukturaStrom(rozeber('=' + p.oblast, this.jazyk), osa, od, pocet), { jazyk: this.jazyk });
        if (o.includes('#')) return null;
        const q = { ...p, oblast: o.slice(1) };
        for (const k of ['h1', 'h2']) {
          const t = String(p[k] ?? '');
          if (t.startsWith('=') || (k === 'h1' && p.typ === 'vzorec' && t)) q[k] = '=' + vykresli(strukturaStrom(rozeber(t.startsWith('=') ? t : '=' + t, this.jazyk), osa, od, pocet), { jazyk: this.jazyk });
        }
        return q;
      } catch (e) { return p; }
    }).filter(Boolean);
    if (this.tabulky) this.tabulky = this.tabulky.map(t => {
      const sm = (x, osaX) => osa === osaX && pocet < 0 && x >= od && x <= od - pocet - 1;   /* index x leží ve smazaném rozsahu */
      if (sm(t.r1, 'r')) return null;   /* smazané záhlaví = konec tabulky */
      const st = strukturaStrom({ t: 'range', a: { t: 'ref', r: t.r1, c: t.c1 }, b: { t: 'ref', r: t.r2, c: t.c2 } }, osa, od, pocet);
      if (st.t !== 'range') return null;
      const souhrn = t.souhrn && !sm(t.r2, 'r');   /* smazaný řádek součtů */
      /* Excel nechá vždy aspoň jeden (prázdný) řádek dat */
      return { ...t, r1: st.a.r, c1: st.a.c, r2: Math.max(st.b.r, st.a.r + 1 + (souhrn ? 1 : 0)), c2: st.b.c, souhrn };
    }).filter(Boolean);
    if (osa === 'r') this.radku = Math.max(1, this.radku + pocet); else this.sloupcu = Math.max(1, this.sloupcu + pocet);
    if (this.sesit && this.nazev) {
      const jm = this.nazev.toUpperCase();
      this.sesit.prepisVzorce(st => strukturaStrom(st, osa, od, pocet, n => n.list && n.list.toUpperCase() === jm), this);
    }
    this.zneplatni();
  }
  /* seřadí řádky oblasti podle sloupce klicC; vzorce se posunou se svým řádkem */
  serad(o, klicC, vzestupne = true) {
    const radky = [];
    for (let r = o.r1; r <= o.r2; r++) radky.push(r);
    const klic = r => { let v = this.hodnota(adresa(r, klicC)); if (jePole(v)) v = v.h[0][0]; return v; };
    const k = new Map(radky.map(r => [r, klic(r)]));
    const prazdne = v => v === null || v === undefined || v === '';
    const poradi = [...radky].sort((x, y) => {
      const a = k.get(x), b = k.get(y);
      if (prazdne(a) || prazdne(b)) return prazdne(a) - prazdne(b) || x - y;
      if (jeChyba(a) || jeChyba(b)) return jeChyba(a) - jeChyba(b) || x - y;
      return (vzestupne ? porovnej(a, b) : porovnej(b, a)) || x - y;
    });
    const stare = {}, sf = {};
    for (const r of radky) for (let c = o.c1; c <= o.c2; c++) { const a = adresa(r, c); stare[a] = this.surova(a); sf[a] = this.format[a]; }
    poradi.forEach((zR, i) => {
      const r = o.r1 + i;
      for (let c = o.c1; c <= o.c2; c++) {
        let x = stare[adresa(zR, c)];
        if (x.startsWith('=') && r !== zR) { try { x = posunVzorec(x, r - zR, 0, this.jazyk); } catch (e) { /* beze změny */ } }
        this.nastav(adresa(r, c), x);
        if (sf[adresa(zR, c)]) this.format[adresa(r, c)] = sf[adresa(zR, c)]; else delete this.format[adresa(r, c)];
      }
    });
    this.zneplatni();
    return poradi;
  }
  hledej(text, volby = {}) {
    if (!text) return [];
    const re = new RegExp(volby.cela ? '^' + escRe(text) + '$' : escRe(text), volby.velikost ? '' : 'i');
    return Object.keys(this.bunky).filter(a => {
      const raw = this.surova(a);
      return re.test(raw.startsWith('=') ? (volby.vzorce === false ? this.zobraz(a) : raw) : raw);
    }).sort((x, y) => { const p = rozeberAdresu(x), q = rozeberAdresu(y); return p.r - q.r || p.c - q.c; });
  }
  nahrad(text, nove, volby = {}) {
    const adr = this.hledej(text, { ...volby, vzorce: true });
    const re = new RegExp(volby.cela ? '^' + escRe(text) + '$' : escRe(text), volby.velikost ? 'g' : 'gi');
    adr.forEach(a => this.nastav(a, this.surova(a).replace(re, () => nove)));
    return adr;
  }
  klon() {
    const l = new List({}, { jazyk: this.jazyk, radku: this.radku, sloupcu: this.sloupcu });
    l.bunky = { ...this.bunky }; l.format = { ...this.format };
    if (this.tabulky) l.tabulky = this.tabulky.map(t => ({ ...t }));
    if (this.sesit) { l.sesit = this.sesit; l.nazev = this.nazev; l.cache = new Map(); l.pocita = new Set(); l.zneplatni = function () { this.cache = new Map(); }; }
    return l;
  }
  /* přepne jazyk zápisu – vzorce i desetinná čísla se přeloží */
  prepniJazyk(na) {
    if (na === this.jazyk) return;
    const zahlavi = a => { const p = rozeberAdresu(a); return p && (this.tabulky || []).some(t => p.r === t.r1 && p.c >= t.c1 && p.c <= t.c2); };
    for (const [a, s] of Object.entries(this.bunky)) {
      if (s.startsWith('=')) this.bunky[a] = prelozVzorec(s, this.jazyk, na);
      else if (zahlavi(a)) continue;   /* záhlaví tabulky je název sloupce, ne číslo */
      else if (na === 'en' && /^-?\d+,\d+$/.test(s)) this.bunky[a] = s.replace(',', '.');
      else if (na === 'cs' && /^-?\d+\.\d+$/.test(s)) this.bunky[a] = s.replace('.', ',');
    }
    this.jazyk = na;
    this.cache = new Map();
  }
}

/* ---------- sešit: víc listů a pojmenované názvy ---------- */
class Sesit {
  constructor(jazyk = 'cs') { this.jazyk = jazyk; this.listy = []; this.nazvy = {}; this.pocita = new Set(); }
  pridejList(nazev, list = new List({}, { jazyk: this.jazyk })) { list.nazev = nazev; list.sesit = this; list.jazyk = this.jazyk; this.listy.push(list); this.zneplatni(); return list; }
  list(nazev) { const n = String(nazev).toUpperCase(); return this.listy.find(l => l.nazev.toUpperCase() === n) || null; }
  zneplatni() { this.listy.forEach(l => { l.cache = new Map(); }); }
  volnyNazev(zaklad = 'List') { let i = this.listy.length + 1; while (this.list(zaklad + i)) i++; return zaklad + i; }
  /* přepíše odkazy ve všech vzorcích (kromě listu vynech) a v definicích názvů */
  prepisVzorce(fn, vynech = null) {
    for (const l of this.listy) {
      if (l === vynech) continue;
      for (const [a, raw] of Object.entries(l.bunky)) {
        if (!raw.startsWith('=')) continue;
        try { l.bunky[a] = '=' + vykresli(fn(rozeber(raw, this.jazyk)), { jazyk: this.jazyk }); } catch (e) { /* chybný vzorec beze změny */ }
      }
    }
    for (const [n, d] of Object.entries(this.nazvy)) {
      try { this.nazvy[n] = '=' + vykresli(fn(rozeber(String(d).startsWith('=') ? d : '=' + d, this.jazyk)), { jazyk: this.jazyk }); } catch (e) { /* beze změny */ }
    }
    this.zneplatni();
  }
  prejmenujList(stary, novy) {
    const l = this.list(stary); if (!l) return false;
    if (this.list(novy) && this.list(novy) !== l) throw new Error(`List „${novy}“ už existuje.`);
    const S = stary.toUpperCase();
    const fn = st => (function k(u) {
      if (u.t === 'ref') return u.list && u.list.toUpperCase() === S ? { ...u, list: novy } : u;
      if (u.t === 'range') return u.a.list && u.a.list.toUpperCase() === S ? { ...u, a: { ...u.a, list: novy }, b: { ...u.b, list: novy } } : u;
      if (u.t === 'fn') return { ...u, args: u.args.map(k) };
      if (u.t === 'op') return { ...u, l: k(u.l), r: k(u.r) };
      if (u.x) return { ...u, x: k(u.x) };
      return u;
    })(st);
    l.nazev = novy;
    this.prepisVzorce(fn);
    return true;
  }
  smazList(nazev) {
    const l = this.list(nazev); if (!l || this.listy.length < 2) return false;
    const S = nazev.toUpperCase();
    this.listy = this.listy.filter(x => x !== l);
    const fn = st => (function k(u) {
      if (u.t === 'ref') return u.list && u.list.toUpperCase() === S ? { t: 'err', v: 'REF', s: u.s, e: u.e } : u;
      if (u.t === 'range') return u.a.list && u.a.list.toUpperCase() === S ? { t: 'err', v: 'REF', s: u.s, e: u.e } : u;
      if (u.t === 'fn') return { ...u, args: u.args.map(k) };
      if (u.t === 'op') return { ...u, l: k(u.l), r: k(u.r) };
      if (u.x) return { ...u, x: k(u.x) };
      return u;
    })(st);
    this.prepisVzorce(fn);
    return true;
  }
  /* název: písmeno nebo _, dál písmena, číslice, tečka; nesmí vypadat jako adresa ani PRAVDA */
  platnyNazev(n) {
    if (!/^[A-Za-zÀ-ž_][\wÀ-ž.]*$/.test(n)) return 'Název musí začínat písmenem a obsahovat jen písmena, číslice, _ a tečku (bez mezer).';
    if (/^[A-Za-z]{1,3}\d+$/.test(n)) return 'Název nesmí vypadat jako adresa buňky (např. DPH1).';
    if (/^(TRUE|FALSE|PRAVDA|NEPRAVDA)$/i.test(n) || ALIAS[n.toUpperCase()]) return 'Název nesmí být stejný jako funkce nebo logická hodnota.';
    if (this.listy.some(l => (l.tabulky || []).some(t => t.nazev.toUpperCase() === n.toUpperCase()))) return `Název ${n} už má tabulka.`;
    return null;
  }
  prepniJazyk(na) {
    if (na === this.jazyk) return;
    for (const [n, d] of Object.entries(this.nazvy)) this.nazvy[n] = prelozVzorec(String(d).startsWith('=') ? d : '=' + d, this.jazyk, na);
    this.listy.forEach(l => l.prepniJazyk(na));
    this.jazyk = na; this.zneplatni();
  }
  serializuj() {
    return { jazyk: this.jazyk, nazvy: { ...this.nazvy }, listy: this.listy.map(l => ({ nazev: l.nazev, bunky: { ...l.bunky }, format: { ...l.format }, sirky: { ...(l.sirky || {}) }, kukatko: [...(l.kukatko || [])], pravidla: (l.pravidla || []).map(p => ({ ...p })), tabulky: (l.tabulky || []).map(t => ({ ...t })) })) };
  }
  /* obnova ze serializovaných dat (i ze sdíleného odkazu nebo souboru = nedůvěryhodný vstup):
     každá hodnota se ověří a převede na povolený tvar, aby se do stránky nedostal cizí kód ani rozbitý stav */
  static obnov(d, jazyk) {
    d = d && typeof d === 'object' ? d : {};
    const s = new Sesit(d.jazyk === 'en' ? 'en' : 'cs');
    /* adresy z nedůvěryhodných dat: nejvýš 2000 řádků × 200 sloupců, jinak by kreslení listu zamrzlo */
    const jeAdr = a => { if (typeof a !== 'string' || !/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(a)) return false; const p = rozeberAdresu(a); return p.r <= 2000 && p.c <= 200; };
    const TYPY_F = ['obecny', 'cislo', 'mena', 'proc', 'datum', 'text'], TYPY_P = ['vetsi', 'mensi', 'mezi', 'rovno', 'obsahuje', 'top', 'nadprumer', 'duplicita', 'vzorec', 'pruh', 'skala'];
    const STYLY = ['cervena', 'zelena', 'zluta', 'modra', 'tucne'];
    const cistyFormat = f => {
      const o = {};
      if (TYPY_F.includes(f.t)) o.t = f.t;
      if (Number.isInteger(f.d) && f.d >= 0 && f.d <= 10) o.d = f.d;
      if (typeof f.tis === 'boolean') o.tis = f.tis;
      if (f.b === true) o.b = true;
      if (['l', 'c', 'r'].includes(f.z)) o.z = f.z;
      return o;
    };
    const text = (v, n) => (v === null || v === undefined ? undefined : String(v).slice(0, n));
    for (const x of (Array.isArray(d.listy) ? d.listy : []).slice(0, 50)) {
      if (!x || typeof x !== 'object') continue;
      const l = new List({}, { jazyk: s.jazyk });
      for (const [a, v] of Object.entries(x.bunky || {})) if (jeAdr(a) && v !== null && v !== undefined && typeof v !== 'object') l.bunky[a] = String(v).slice(0, 5000);
      for (const [a, f] of Object.entries(x.format || {})) if (jeAdr(a) && f && typeof f === 'object') { const o = cistyFormat(f); if (Object.keys(o).length) l.format[a] = o; }
      l.sirky = {};
      for (const [c, w] of Object.entries(x.sirky || {})) { const n = Math.round(Number(w)); if (/^\d{1,4}$/.test(c) && n >= 20 && n <= 800) l.sirky[c] = n; }
      l.kukatko = (Array.isArray(x.kukatko) ? x.kukatko : []).filter(jeAdr).slice(0, 60);
      l.pravidla = (Array.isArray(x.pravidla) ? x.pravidla : []).filter(p => p && typeof p.oblast === 'string' && /^\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/.test(p.oblast) && TYPY_P.includes(p.typ))
        .slice(0, 50).map(p => ({ oblast: p.oblast.toUpperCase(), typ: p.typ, h1: text(p.h1, 500), h2: text(p.h2, 500), styl: STYLY.includes(p.styl) ? p.styl : 'cervena' }));
      const cele = v => Number.isInteger(v) && v >= 1 && v <= 100000;
      const prekryv = (a, b) => !(a.r2 < b.r1 || a.r1 > b.r2 || a.c2 < b.c1 || a.c1 > b.c2);
      const jmenaTab = new Set(s.listy.flatMap(q => (q.tabulky || []).map(t => t.nazev.toUpperCase())));
      l.tabulky = [];
      for (const t of (Array.isArray(x.tabulky) ? x.tabulky : []).slice(0, 20)) {
        if (!t || !platnyNazevTabulky(t.nazev) || !['r1', 'c1', 'r2', 'c2'].every(k => cele(t[k])) || t.c2 > 16384 || t.c1 > t.c2) continue;
        if (t.r2 <= t.r1 + (t.souhrn ? 1 : 0) || (t.r2 - t.r1 + 1) * (t.c2 - t.c1 + 1) > 1e6 || jmenaTab.has(t.nazev.toUpperCase()) || l.tabulky.some(q => prekryv(q, t))) continue;
        jmenaTab.add(t.nazev.toUpperCase());
        l.tabulky.push({ nazev: t.nazev, r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2, souhrn: !!t.souhrn });
      }
      for (const a of Object.keys(l.bunky)) { const p = rozeberAdresu(a); if (p) { l.radku = Math.max(l.radku, p.r); l.sloupcu = Math.max(l.sloupcu, p.c); } }
      let nazev = String(x.nazev || '').replace(/[\\/?*[\]:!]/g, '_').trim().slice(0, 31);
      if (!nazev || s.list(nazev)) nazev = s.volnyNazev();
      s.pridejList(nazev, l);
    }
    for (const [n, def] of Object.entries(d.nazvy && typeof d.nazvy === 'object' ? d.nazvy : {})) {
      if (typeof def === 'string' && !s.platnyNazev(n)) s.nazvy[n.toUpperCase()] = def.slice(0, 500);   /* platnyNazev hlídá i kolizi s tabulkou */
    }
    if (!s.listy.length) s.pridejList('List1');
    if (jazyk && jazyk !== s.jazyk) s.prepniJazyk(jazyk);
    return s;
  }

}

/* ---------- pomůcky pro editor ---------- */
/* odkazy ve vzorci s pozicemi (pro barevné zvýraznění) */
function odkazyVeVzorci(vzorec, jazyk, list, a) {
  if (!String(vzorec).startsWith('=')) return [];
  let tok;
  try { tok = tokenizuj(vzorec.slice(1), jazyk, true); } catch (e) { return []; }
  const out = [];
  for (let i = 0; i < tok.length; i++) {
    const k = tok[i];
    if (list && (k.t === 'tab' || (k.t === 'name' && list.najdiTabulku(k.text)))) {   /* Tab[Sloupec] → oblast v listu */
      let o = null;
      try { o = list.oblastOdkazu(k.t === 'tab' ? { t: 'tab', tab: k.tab, ...rozeberSpec(k.spec) } : { t: 'tab', tab: k.text, cast: 'data' }, a); } catch (e) { o = null; }
      if (o) out.push({ s: k.s + 1, e: k.e + 1, ...o });
      continue;
    }
    if (k.t !== 'ref' || (i > 0 && tok[i - 1].t === 'sheet')) continue;
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
  const re = /(?<![\wÀ-ž.])\$?[A-Za-z]{1,3}\$?\d+(?![\wÀ-ž!(])/g;
  /* uvnitř "textu" a [sloupce tabulky] F4 nic nepřepíná */
  const maska = vzorec.replace(/"[^"]*"?/g, x => ' '.repeat(x.length)).replace(/\[[^\]]*\]?/g, x => ' '.repeat(x.length));
  let m;
  while ((m = re.exec(vzorec))) {
    const z = m.index, k = z + m[0].length;
    if (maska.slice(z, k).trim() !== m[0]) continue;
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
  if (jePole(a) || jePole(b)) {   /* pole se porovnávají celá (rozměr i všechny prvky) */
    const ha = jePole(a) ? a.h : [[a]], hb = jePole(b) ? b.h : [[b]];
    if (ha.length !== hb.length || ha[0].length !== hb[0].length) return false;
    return ha.every((r, i) => r.every((x, j) => stejne(x, hb[i][j])));
  }
  if (jeChyba(a) || jeChyba(b)) return jeChyba(a) && jeChyba(b) && a.kod === b.kod;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  if ((a === null || a === '') && (b === null || b === '')) return true;
  return a === b;
}
/* náhodná obměna číselných vstupů – aby nešlo opsat výsledek místo vzorce */
function obmenaDat(list, nahoda, chranit = []) {
  const l = list.klon();
  const pevne = a => { const p = rozeberAdresu(a); return (list.tabulky || []).some(t => p.c >= t.c1 && p.c <= t.c2 && (p.r === t.r1 || (t.souhrn && p.r === t.r2))); };
  for (const [a, s] of Object.entries(list.bunky)) {
    if (s.startsWith('=') || chranit.includes(a) || pevne(a)) continue;
    const n = textNaCislo(s);
    if (n === null || list.jeDatum(a)) continue;
    if (/%\s*$/.test(s)) {   /* procenta se obmění taky – jinak by prošel vzorec s natvrdo zapsanou sazbou */
      const p0 = Math.round(n * 100); let p = Math.max(1, Math.round(p0 * (0.6 + nahoda() * 0.8)));
      if (p === p0) p = p0 + 1;
      l.bunky[a] = p + '%'; continue;
    }
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
function rozborStromu(strom, list) {
  const fn = new Set(), refy = [];
  (function pruchod(u) {
    if (!u) return;
    if (u.t === 'jmeno' && list) {   /* samotný název tabulky (=SUMA(Prodej)) nebo definovaný název je také odkaz */
      if (list.najdiTabulku(u.v)) refy.push({ t: 'tab', tab: u.v, absR: true, absC: true });
      else if (list.sesit && list.sesit.nazvy[u.v.toUpperCase()] !== undefined) refy.push({ t: 'jmeno', absR: true, absC: true });
    }
    if (u.t === 'fn') { if (u.en) fn.add(u.en); u.args.forEach(pruchod); }
    else if (u.t === 'ref') refy.push(u);
    else if (u.t === 'range') refy.push(u.a, u.b);
    else if (u.t === 'tab') refy.push({ t: 'tab', tab: u.tab, absR: true, absC: true });   /* strukturovaný odkaz se při kopírování neposouvá */
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
  const { fn, refy } = rozborStromu(strom, list);
  for (const f of uloha.vyzaduje || []) {
    if (!fn.has(f)) return { ok: false, zprava: `Úloha chce použít funkci ${nazevFunkce(f, jaz)}.` };
  }
  if (!refy.length) return { ok: false, zprava: 'Vzorec neobsahuje žádný odkaz na buňku. Počítejte s buňkami (např. B2), ne s opsanými čísly – když se data změní, výsledek se musí sám přepočítat.' };
  if (uloha.tabulka && !refy.some(r => r.t === 'tab')) return { ok: false, zprava: 'Úloha chce strukturovaný odkaz na tabulku – pište názvy sloupců, např. Prodej[Kusy] nebo [@Kusy], ne adresy jako C2.' };
  if (uloha.absolutni && !uloha.oprava && !refy.some(r => r.absR || r.absC)) return { ok: false, zprava: 'Při kopírování se odkazy posouvají. Některý odkaz je potřeba ukotvit znakem $ (v poli vzorce klávesa F4).' };

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
      if (uloha.oprava) zprava = c !== uloha.cil ? `Vzorec ještě není opravený: po zkopírování do ${c} vrací ${lit(a)} místo ${lit(b)}.`   /* Oprav vzorec: rady k jiné chybě by mátly */
        : si > 0 ? `Vzorec ještě není opravený: po změně vstupních dat vrací ${lit(a)} místo ${lit(b)}.` : `Vzorec ještě není opravený: vrací ${lit(a)} místo ${lit(b)}.`;
      else if (si > 0) zprava = `S původními daty to vychází, ale po změně vstupních čísel vzorec v ${c} vrací ${lit(a)} místo ${lit(b)}. Nepočítá s opsaným číslem místo odkazu na buňku?`;
      else if (c !== uloha.cil) zprava = `V buňce ${uloha.cil} to vychází, ale po zkopírování do ${c} vzorec vrací ${lit(a)} místo ${lit(b)}. Které odkazy se mají při kopírování posouvat a které ukotvit znakem $?`;
      else zprava = `Vzorec vrací ${lit(a)}, ale správný výsledek je ${lit(b)}.`;
      return { ok: false, zprava };
    }
  }
  return { ok: true, zprava: cile.length > 1 ? `Správně! Vzorec funguje ve všech ${cile.length} buňkách i po změně dat.` : 'Správně! Vzorec funguje i po změně vstupních dat.' };
}

/* vzorec bez strukturovaných odkazů (Tab[Sloupec] → B2:B9) – pro export do souboru bez definic tabulek */
function bezTabulek(vzorec, list, a, jazyk = list.jazyk, jen = null) {
  if (!String(vzorec).startsWith('=') || !/\[|\b/.test(vzorec)) return vzorec;
  try {
    const kde = a ? rozeberAdresu(a) : null, strom = rozeber(vzorec, list.jazyk), lety = letNazvy(strom);
    const nahrad = u => {
      const tab = u.t === 'tab' ? u : u.t === 'jmeno' && !lety.has(u.v.toUpperCase()) && list.najdiTabulku(u.v) ? { t: 'tab', tab: u.v, cast: 'data' } : null;
      if (tab) {
        const o = list.najdiTabulku(tab.tab, kde); if (!o) return { t: 'err', v: 'REF' };
        if (jen && o.nazev.toUpperCase() !== jen.toUpperCase()) return u;   /* převádí se jen zrušená tabulka */
        let ob; try { ob = oblastTab(tab, o, kde); } catch (e) { return { t: 'err', v: e.kod || 'REF' }; }
        const roh = (r, c) => ({ t: 'ref', r, c, absR: tab.cast !== 'radek', absC: true, list: o.list });   /* tento řádek → relativní řádek */
        return ob.r1 === ob.r2 && ob.c1 === ob.c2 ? roh(ob.r1, ob.c1) : { t: 'range', a: roh(ob.r1, ob.c1), b: roh(ob.r2, ob.c2) };
      }
      switch (u.t) {
        case 'zav': case 'un': case 'pct': return { ...u, x: nahrad(u.x) };
        case 'op': return { ...u, l: nahrad(u.l), r: nahrad(u.r) };
        case 'fn': return { ...u, args: u.args.map(nahrad) };
        default: return u;
      }
    };
    return '=' + vykresli(nahrad(strom), { jazyk });
  } catch (e) { return vzorec; }
}

/* nahradí čipy [[=vzorec]] v textu – s počítáním hranatých závorek (vzorec může obsahovat Tab[[#All],[A]]) */
function nahradCipy(text, fn) {
  let out = '', i = 0;
  for (;;) {
    const z = text.indexOf('[[=', i);
    if (z < 0) return out + text.slice(i);
    let j = z + 2, h = 0, uvoz = false, konec = -1;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (ch === '"') uvoz = !uvoz;
      else if (uvoz) continue;
      else if (ch === '[') h++;
      else if (ch === ']') { if (h === 0 && text[j + 1] === ']') { konec = j; break; } h--; }
    }
    if (konec < 0) return out + text.slice(i);
    out += text.slice(i, z) + fn(text.slice(z + 2, konec));
    i = konec + 2;
  }
}

koren.XLV = {
  nahradCipy, rozeberSpec, textTab, oblastTab, platnyNazevTabulky, bezTabulek,
  Chyba, CHYBY, FUNKCE, ALIAS, List, Sesit, textListu,
  tokenizuj, rozeber, vykresli, literal, vyhodnotUzel, posunStrom, posunVzorec, prelozVzorec,
  odkazyVeVzorci, tokenyProZvyrazneni, napovedaKurzoru, navrhyFunkci, prepniAbsolutni, zkontroluj, rozborStromu,
  normFormat, pokracujRadu, formatujText, odkazyStromu, strukturaStrom, posunIndex,
  adresa, rozeberAdresu, sloupecNaCislo, cisloNaSloupec, fmtCislo, fmtDatum, serialZData, nazevFunkce, oddelovac, jeChyba, jePole, textRef,
};
})(typeof window !== 'undefined' ? window : globalThis);
