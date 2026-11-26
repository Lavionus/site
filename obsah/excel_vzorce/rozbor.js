/* Rozbor vlastního vzorce (window.XLV_ROZBOR): rozpoznání zápisu, slovní vysvětlení,
   postup zevnitř ven, rady k typickým chybám a ukázková data pro odkazované buňky.
   Bez DOM – testuje se v node (_test/excel_vzorce_rozbor_test.js). */
(function (koren) {
'use strict';
const X = koren.XLV;

/* ---------- rozpoznání jazyka zápisu ---------- */
function rozpoznej(text, preferovany = 'cs') {
  let t = String(text || '').trim();
  if (!t) return { chyba: 'Napište vzorec.' };
  if (!t.startsWith('=')) t = '=' + t;
  /* odhad podle textu mimo uvozovky: středník nebo české názvy funkcí = český zápis, čárka mezi argumenty = anglický */
  const bez = t.replace(/"[^"]*"?/g, '""');
  const jmena = [...bez.matchAll(/([A-Za-zÀ-ž][\wÀ-ž.]*)\s*\(/g)].map(m => m[1].toUpperCase());
  const ceske = jmena.some(n => X.ALIAS[n] && X.FUNKCE[X.ALIAS[n]].cs.toUpperCase() === n && X.ALIAS[n] !== n);
  const anglicke = jmena.some(n => X.FUNKCE[n] && X.FUNKCE[n].cs.toUpperCase() !== n);
  let odhad = preferovany;
  if (bez.includes(';') || (ceske && !anglicke)) odhad = 'cs';
  else if (anglicke && !ceske) odhad = 'en';
  else if (/[A-Za-z)"]\s*,|,\s*["A-Za-z$(]/.test(bez)) odhad = 'en';
  const pokusy = [odhad, odhad === 'cs' ? 'en' : 'cs'];
  let prvni = null;
  for (const j of pokusy) {
    try { return { vzorec: t, jazyk: j, strom: X.rozeber(t, j) }; }
    catch (e) { if (!prvni) prvni = { chyba: e.message, pozice: e.pozice, vzorec: t, jazyk: j }; }
  }
  /* zkusit poradit podle závorek a oddělovačů */
  const otv = (t.match(/\(/g) || []).length, zav = (t.match(/\)/g) || []).length;
  if (otv > zav) prvni.rada = `Chybí ${otv - zav}× uzavírací závorka „)“.`;
  else if (zav > otv) prvni.rada = `Uzavíracích závorek je o ${zav - otv} víc než otevíracích.`;
  else if ((t.match(/"/g) || []).length % 2) prvni.rada = 'Lichý počet uvozovek – nějaký text není uzavřený.';
  return prvni;
}

/* ---------- slovní popis (česky; v anglickém rozhraní anglicky – věty se skládají, slovník je nepřeloží) ---------- */
const anglicky = () => !!(koren.I18N && koren.I18N.jazyk && koren.I18N.jazyk !== 'cs');
const POROVNANI_EN = { '=': 'equals', '<>': 'does not equal', '<': 'is less than', '>': 'is greater than', '<=': 'is at most', '>=': 'is at least' };
function vetaFunkceEn(u, a, d, j) {
  const en = u.en, n = u.args, sez = x => x.filter(Boolean).join(', ');
  const shoda = (arg, pr) => !arg || arg.t === 'prazdny' ? (pr ? 'APPROXIMATE match – the last argument is missing' : 'exact match')
    : arg.t === 'bool' ? (arg.v ? 'approximate match' : 'exact match') : arg.t === 'num' ? (arg.v === 0 ? 'exact match' : 'approximate match') : 'match by ' + d(arg);
  const mista = arg => arg && arg.t === 'num' ? (arg.v === 0 ? 'a whole number' : arg.v > 0 ? `${arg.v} decimal place${arg.v === 1 ? '' : 's'}` : `${Math.pow(10, -arg.v)}s`) : `${d(arg)} digits`;
  const krit = k => popisKriteriaEn(k, d);
  switch (en) {
    case 'SUM': return `adds up ${sez(a)}`;
    case 'AVERAGE': return `calculates the average of ${sez(a)} (sum ÷ count of numbers)`;
    case 'MIN': return `finds the smallest value in ${sez(a)}`;
    case 'MAX': return `finds the largest value in ${sez(a)}`;
    case 'MEDIAN': return `finds the middle value (median) of ${sez(a)}`;
    case 'COUNT': return `counts how many numbers are in ${sez(a)}`;
    case 'COUNTA': return `counts the non-empty cells in ${sez(a)}`;
    case 'PRODUCT': return `multiplies ${sez(a)} together`;
    case 'ROUND': return `rounds ${a[0]} to ${mista(n[1])}`;
    case 'ROUNDUP': return `rounds ${a[0]} always UP to ${mista(n[1])}`;
    case 'ROUNDDOWN': return `rounds ${a[0]} always DOWN (truncates) to ${mista(n[1])}`;
    case 'INT': return `takes the integer part of ${a[0]} (rounds down)`;
    case 'MOD': return `calculates the remainder of ${a[0]} divided by ${a[1]}`;
    case 'IF': return `if ${a[0]}, returns ${a[1] || 'TRUE'}, otherwise returns ${n.length > 2 ? a[2] || '0' : 'FALSE'}`;
    case 'IFS': { const c = []; for (let i = 0; i + 1 < a.length; i += 2) c.push(n[i].t === 'bool' && n[i].v ? `otherwise returns ${a[i + 1]}` : `if ${a[i]}, returns ${a[i + 1]}`); return 'tries the conditions in turn: ' + c.join('; '); }
    case 'IFERROR': return `returns ${a[0]}; if any error occurs there, returns ${a[1] || '0'} instead`;
    case 'IFNA': return `returns ${a[0]}; if the value was not found (#N/A), returns ${a[1] || '0'}`;
    case 'AND': return `is true only if all of these are true: ${a.join(' AND ')}`;
    case 'OR': return `is true if at least one is true: ${a.join(' OR ')}`;
    case 'NOT': return `reverses the result: true when ${a[0]} is NOT true`;
    case 'COUNTIF': return `counts the cells in ${a[0]} whose value ${krit(n[1])}`;
    case 'SUMIF': return `adds up the values in ${a[2] || a[0]} in rows where the value in ${a[0]} ${krit(n[1])}`;
    case 'AVERAGEIF': return `averages the values in ${a[2] || a[0]} in rows where the value in ${a[0]} ${krit(n[1])}`;
    case 'COUNTIFS': case 'SUMIFS': case 'AVERAGEIFS': case 'MAXIFS': case 'MINIFS': {
      const od = en === 'COUNTIFS' ? 0 : 1, c = [];
      for (let i = od; i + 1 < n.length; i += 2) c.push(`the value in ${a[i]} ${krit(n[i + 1])}`);
      return ({ COUNTIFS: 'counts the rows where ', SUMIFS: `adds up the values in ${a[0]} in rows where `, AVERAGEIFS: `averages ${a[0]} in rows where `, MAXIFS: `finds the largest of ${a[0]} in rows where `, MINIFS: `finds the smallest of ${a[0]} in rows where ` })[en] + c.join(' AND ');
    }
    case 'VLOOKUP': return `looks up ${a[0]} in the FIRST column of the table ${a[1]} and returns the value from column number ${a[2]} of the same row (${shoda(n[3], true)})`;
    case 'HLOOKUP': return `looks up ${a[0]} in the FIRST row of the table ${a[1]} and returns the value from row number ${a[2]} of the same column (${shoda(n[3], true)})`;
    case 'MATCH': return `finds the position of ${a[0]} in ${a[1]} (${shoda(n[2], true)})`;
    case 'XMATCH': return `finds the position of ${a[0]} in ${a[1]} (exact match)`;
    case 'INDEX': return `takes the value at position ${a[1]}${a[2] ? ` (row), column ${a[2]}` : ''} from ${a[0]}`;
    case 'XLOOKUP': return `finds ${a[0]} in ${a[1]} and returns the value from the same position in ${a[2]}${a[3] ? `; if nothing is found, returns ${a[3]}` : ''}`;
    case 'LEFT': return `takes the first ${a[1] || '1'} characters of ${a[0]}`;
    case 'RIGHT': return `takes the last ${a[1] || '1'} characters of ${a[0]}`;
    case 'MID': return `takes ${a[2]} characters of ${a[0]}, starting at position ${a[1]}`;
    case 'LEN': return `counts the characters in ${a[0]}`;
    case 'UPPER': return `converts ${a[0]} to UPPER CASE`;
    case 'LOWER': return `converts ${a[0]} to lower case`;
    case 'PROPER': return `capitalises each word of ${a[0]}`;
    case 'TRIM': return `removes extra spaces from ${a[0]}`;
    case 'CONCAT': case 'CONCATENATE': return `joins ${sez(a)} together`;
    case 'FIND': return `finds the position of ${a[0]} in ${a[1]} (case-sensitive)`;
    case 'SEARCH': return `finds the position of ${a[0]} in ${a[1]} (not case-sensitive)`;
    case 'SUBSTITUTE': return `replaces ${a[1]} with ${a[2]} in ${a[0]}`;
    case 'TEXT': return `converts ${a[0]} to text in the format ${a[1]}`;
    case 'TEXTBEFORE': return `takes the text of ${a[0]} before ${a[1]}`;
    case 'TEXTAFTER': return `takes the text of ${a[0]} after ${a[1]}`;
    case 'TODAY': return 'returns today’s date';
    case 'DATE': return `builds a date from year ${a[0]}, month ${a[1]} and day ${a[2]}`;
    case 'YEAR': return `takes the year from the date ${a[0]}`;
    case 'MONTH': return `takes the month (1–12) from the date ${a[0]}`;
    case 'DAY': return `takes the day of the month from the date ${a[0]}`;
    case 'FILTER': return `keeps only the rows of ${a[0]} where ${a[1]} is true – the result spills into neighbouring cells`;
    case 'SORT': return `sorts ${a[0]} – the result spills`;
    case 'UNIQUE': return `takes each value of ${a[0]} only once – the result spills`;
    case 'LET': { const c = []; for (let i = 0; i + 1 < a.length; i += 2) c.push(`${a[i]} = ${a[i + 1]}`); return `names intermediate results (${c.join('; ')}) and calculates ${a[a.length - 1]}`; }
    case 'PMT': return `calculates the loan payment for ${a[2]} at rate ${a[0]} per period over ${a[1]} periods`;
  }
  const f = en && X.FUNKCE[en];
  return f ? `${en} (${sez(a)})` : `calls the unknown function ${u.jmeno} – a typo?`;
}
function popisKriteriaEn(u, d) {
  if (u.t === 'str') {
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(u.v), op = m[1] || '=', h = m[2];
    if (h === '') return op === '<>' ? 'is not empty' : 'is empty';
    const hod = /^-?\d+([.,]\d+)?$/.test(h) ? h : `“${h}”`;
    if ((op === '=' || op === '<>') && /[*?]/.test(h)) return `${op === '<>' ? 'does not match' : 'matches'} the pattern ${hod} (* = any characters, ? = one character)`;
    return POROVNANI_EN[op] + ' ' + hod;
  }
  if (u.t === 'op' && u.op === '&' && u.l.t === 'str' && POROVNANI_EN[u.l.v]) return POROVNANI_EN[u.l.v] + ' ' + d(u.r);
  return 'equals ' + d(u);
}
const lit = (v, j) => X.literal(v, j);
const SLOVA_POROVNANI = { '=': 'se rovná', '<>': 'se nerovná', '<': 'je menší než', '>': 'je větší než', '<=': 'je nejvýš', '>=': 'je aspoň' };
const SYMBOLY = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
const PRIOR = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
const NAZVY_OP = { '+': 'součet', '-': 'rozdíl', '*': 'součin', '/': 'podíl', '^': 'mocnina', '&': 'spojení textů' };

function popisKriteria(u, d, j) {
  if (u.t === 'str') {
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(u.v), op = m[1] || '=', h = m[2];
    if (h === '') return op === '<>' ? 'není prázdná' : 'je prázdná';
    const cislo = /^-?\d+([.,]\d+)?$/.test(h);
    const hod = cislo ? h : `„${h}“`;
    if ((op === '=' || op === '<>') && /[*?]/.test(h)) return `${op === '<>' ? 'neodpovídá' : 'odpovídá'} vzoru ${hod} (* = libovolné znaky, ? = jeden znak)`;
    return ({ '=': 'se rovná', '<>': 'se nerovná' }[op] || SLOVA_POROVNANI[op]) + ' ' + hod;
  }
  if (u.t === 'op' && u.op === '&' && u.l.t === 'str' && /^(<=|>=|<>|<|>|=)$/.test(u.l.v)) return SLOVA_POROVNANI[u.l.v] + ' ' + d(u.r);
  return 'se rovná ' + d(u);
}

/* d(u) = popis podvýrazu; fn(en, argumenty-popisy, uzel) = věta o funkci */
function vetaFunkce(u, a, d, j) {
  const en = u.en, n = u.args, sez = x => x.filter(Boolean).join(', ');
  const shoda = (arg, vychoziPribl) => {
    if (!arg || arg.t === 'prazdny') return vychoziPribl ? 'PŘIBLIŽNÁ shoda – chybí poslední argument' : 'přesná shoda';
    if (arg.t === 'bool') return arg.v ? 'přibližná shoda' : 'přesná shoda';
    if (arg.t === 'num') return arg.v === 0 ? 'přesná shoda' : arg.v > 0 ? 'přibližná shoda (největší menší nebo rovná)' : 'přibližná shoda (nejmenší větší nebo rovná)';
    return 'shoda podle ' + d(arg);
  };
  const mista = arg => arg && arg.t === 'num' ? (arg.v === 0 ? 'celé číslo' : arg.v > 0 ? `${arg.v} desetinn${arg.v === 1 ? 'é místo' : arg.v < 5 ? 'á místa' : 'ých míst'}` : `${Math.pow(10, -arg.v)} (záporná místa = desítky, stovky…)`) : `počet míst ${d(arg)}`;
  switch (en) {
    case 'SUM': return `sečte ${sez(a)}`;
    case 'AVERAGE': return `spočítá průměr z ${sez(a)} (součet ÷ počet čísel)`;
    case 'MIN': return `najde nejmenší hodnotu z ${sez(a)}`;
    case 'MAX': return `najde největší hodnotu z ${sez(a)}`;
    case 'MEDIAN': return `najde prostřední hodnotu (medián) z ${sez(a)}`;
    case 'COUNT': return `spočítá, kolik čísel je v ${sez(a)}`;
    case 'COUNTA': return `spočítá neprázdné buňky v ${sez(a)}`;
    case 'COUNTBLANK': return `spočítá prázdné buňky v ${a[0]}`;
    case 'PRODUCT': return `vynásobí mezi sebou ${sez(a)}`;
    case 'SUMPRODUCT': return `vynásobí odpovídající prvky ${sez(a)} a součiny sečte`;
    case 'LARGE': return `najde ${a[1]}. největší hodnotu v ${a[0]}`;
    case 'SMALL': return `najde ${a[1]}. nejmenší hodnotu v ${a[0]}`;
    case 'RANK': return `zjistí pořadí ${a[0]} mezi hodnotami ${a[1]}`;
    case 'ROUND': return `zaokrouhlí ${a[0]} na ${mista(n[1])}`;
    case 'ROUNDUP': return `zaokrouhlí ${a[0]} vždy NAHORU na ${mista(n[1])}`;
    case 'ROUNDDOWN': return `zaokrouhlí ${a[0]} vždy DOLŮ (usekne) na ${mista(n[1])}`;
    case 'INT': return `vezme celou část z ${a[0]} (zaokrouhlí dolů)`;
    case 'MOD': return `spočítá zbytek po dělení ${a[0]} číslem ${a[1]}`;
    case 'ABS': return `vezme ${a[0]} bez znaménka`;
    case 'SQRT': return `spočítá druhou odmocninu z ${a[0]}`;
    case 'POWER': return `umocní ${a[0]} na ${a[1]}`;
    case 'IF': return `když ${a[0]}, vrátí ${a[1] || 'PRAVDA'}, jinak vrátí ${n.length > 2 ? a[2] || '0' : 'NEPRAVDA'}`;
    case 'IFS': {
      const c = [];
      for (let i = 0; i + 1 < a.length; i += 2) c.push(n[i].t === 'bool' && n[i].v ? `jinak vrátí ${a[i + 1]}` : `když ${a[i]}, vrátí ${a[i + 1]}`);
      return 'postupně zkouší podmínky: ' + c.join('; ');
    }
    case 'IFERROR': return `vrátí ${a[0]}; když tam vznikne jakákoli chyba, vrátí místo ní ${a[1] || '0'}`;
    case 'IFNA': return `vrátí ${a[0]}; když hodnota nebyla nalezena (#NENÍ_K_DISPOZICI), vrátí ${a[1] || '0'}`;
    case 'AND': return `platí, jen když platí zároveň: ${a.join(' A ZÁROVEŇ ')}`;
    case 'OR': return `platí, když platí aspoň jedno: ${a.join(' NEBO ')}`;
    case 'NOT': return `obrátí pravdivost: platí, když NEPLATÍ ${a[0]}`;
    case 'CHOOSE': return `vybere z hodnot ${sez(a.slice(1))} tu s pořadím ${a[0]}`;
    case 'COUNTIF': return `spočítá buňky v ${a[0]}, jejichž hodnota ${popisKriteria(n[1], d, j)}`;
    case 'SUMIF': return `sečte hodnoty z ${a[2] || a[0]} v řádcích, kde hodnota v ${a[0]} ${popisKriteria(n[1], d, j)}`;
    case 'AVERAGEIF': return `spočítá průměr hodnot z ${a[2] || a[0]} v řádcích, kde hodnota v ${a[0]} ${popisKriteria(n[1], d, j)}`;
    case 'COUNTIFS': case 'SUMIFS': {
      const od = en === 'SUMIFS' ? 1 : 0, c = [];
      for (let i = od; i + 1 < n.length; i += 2) c.push(`hodnota v ${a[i]} ${popisKriteria(n[i + 1], d, j)}`);
      return (en === 'SUMIFS' ? `sečte hodnoty z ${a[0]} v řádcích, kde ` : 'spočítá řádky, kde ') + c.join(' A ZÁROVEŇ ');
    }
    case 'VLOOKUP': return `vyhledá ${a[0]} v PRVNÍM sloupci tabulky ${a[1]} a vrátí hodnotu ze sloupce číslo ${a[2]} na stejném řádku (${shoda(n[3], true)})`;
    case 'HLOOKUP': return `vyhledá ${a[0]} v PRVNÍM řádku tabulky ${a[1]} a vrátí hodnotu z řádku číslo ${a[2]} ve stejném sloupci (${shoda(n[3], true)})`;
    case 'MATCH': return `zjistí, na kolikáté pozici v ${a[1]} je ${a[0]} (${shoda(n[2], true)})`;
    case 'INDEX': return `vezme z ${a[0]} hodnotu na pozici ${a[1]}${a[2] ? ` (řádek), sloupec ${a[2]}` : ''}`;
    case 'XLOOKUP': return `najde ${a[0]} v ${a[1]} a vrátí hodnotu ze stejné pozice v ${a[2]}${a[3] ? `; když nic nenajde, vrátí ${a[3]}` : ''}`;
    case 'LEFT': return `vezme prvních ${a[1] || '1'} znaků z ${a[0]}`;
    case 'RIGHT': return `vezme posledních ${a[1] || '1'} znaků z ${a[0]}`;
    case 'MID': return `vezme ${a[2]} znaků z ${a[0]}, počínaje znakem na pozici ${a[1]}`;
    case 'LEN': return `spočítá, kolik znaků má ${a[0]}`;
    case 'UPPER': return `převede ${a[0]} na VELKÁ písmena`;
    case 'LOWER': return `převede ${a[0]} na malá písmena`;
    case 'PROPER': return `převede ${a[0]} tak, aby každé slovo začínalo velkým písmenem`;
    case 'TRIM': return `odstraní z ${a[0]} přebytečné mezery`;
    case 'CONCAT': case 'CONCATENATE': return `spojí za sebe ${sez(a)}`;
    case 'TEXTJOIN': return `spojí ${sez(a.slice(2))} a mezi ně vloží ${a[0]}`;
    case 'FIND': return `najde pozici ${a[0]} v ${a[1]} (rozlišuje velká a malá písmena)`;
    case 'SEARCH': return `najde pozici ${a[0]} v ${a[1]} (nerozlišuje velikost písmen)`;
    case 'SUBSTITUTE': return `v ${a[0]} nahradí ${a[1]} za ${a[2]}`;
    case 'REPT': return `zopakuje ${a[0]} tolikrát, kolik je ${a[1]}`;
    case 'VALUE': return `převede text ${a[0]} na číslo`;
    case 'TEXT': return `převede ${a[0]} na text ve formátu ${a[1]}`;
    case 'TODAY': return 'vrátí dnešní datum';
    case 'DATE': return `složí datum z roku ${a[0]}, měsíce ${a[1]} a dne ${a[2]}`;
    case 'YEAR': return `vezme rok z data ${a[0]}`;
    case 'MONTH': return `vezme měsíc (1–12) z data ${a[0]}`;
    case 'DAY': return `vezme den v měsíci z data ${a[0]}`;
    case 'WEEKDAY': return `zjistí den v týdnu pro ${a[0]}${n[1] && n[1].t === 'num' && n[1].v === 2 ? ' (pondělí = 1)' : ' (neděle = 1)'}`;
    case 'EOMONTH': return `najde poslední den měsíce posunutého od ${a[0]} o ${a[1]} měsíců`;
    case 'NETWORKDAYS': return `spočítá pracovní dny od ${a[0]} do ${a[1]}`;
    case 'FILTER': return `vybere z ${a[0]} jen řádky, kde platí ${a[1]}${a[2] ? `; když žádný není, vrátí ${a[2]}` : ''} – výsledek se rozlije do sousedních buněk`;
    case 'SORT': return `seřadí ${a[0]} podle ${a[1] || '1'}. sloupce ${n[2] && n[2].t === 'un' ? 'sestupně' : 'vzestupně'} – výsledek se rozlije`;
    case 'UNIQUE': return `vybere z ${a[0]} každou hodnotu jen jednou – výsledek se rozlije`;
    case 'SEQUENCE': return `vytvoří řadu čísel s ${a[0]} řádky${a[1] ? ` a ${a[1]} sloupci` : ''} – výsledek se rozlije`;
    case 'XMATCH': return `zjistí, na kolikáté pozici v ${a[1]} je ${a[0]} (přesná shoda)`;
    case 'LET': { const c = []; for (let i = 0; i + 1 < a.length; i += 2) c.push(`${a[i]} = ${a[i + 1]}`); return `pojmenuje mezivýsledky (${c.join('; ')}) a spočítá ${a[a.length - 1]}`; }
    case 'TEXTBEFORE': return `vezme z ${a[0]} text před ${a[1]}`;
    case 'TEXTAFTER': return `vezme z ${a[0]} text za ${a[1]}`;
    case 'PMT': return `spočítá splátku úvěru ${a[2]} při sazbě ${a[0]} za období na ${a[1]} období`;
    case 'FV': return `spočítá, kolik bude naspořeno po ${a[1]} obdobích při sazbě ${a[0]} a vkladu ${a[2]}`;
    case 'DATEDIF': return `spočítá, kolik ${({ '„Y“': 'celých let', '„M“': 'celých měsíců', '„D“': 'dní' })[a[2]] || 'jednotek ' + a[2]} uplynulo od ${a[0]} do ${a[1]}`;
    case 'AVERAGEIFS': case 'MAXIFS': case 'MINIFS': {
      const c = []; for (let i = 1; i + 1 < n.length; i += 2) c.push(`hodnota v ${a[i]} ${popisKriteria(n[i + 1], d, j)}`);
      return `${{ AVERAGEIFS: 'spočítá průměr', MAXIFS: 'najde největší', MINIFS: 'najde nejmenší' }[en]} z ${a[0]} v řádcích, kde ${c.join(' A ZÁROVEŇ ')}`;
    }
    case 'ISBLANK': return `zjistí, zda je ${a[0]} prázdná`;
    case 'ISNUMBER': return `zjistí, zda je ${a[0]} číslo`;
    case 'ISTEXT': return `zjistí, zda je ${a[0]} text`;
    case 'ISERROR': return `zjistí, zda je ${a[0]} chyba`;
  }
  const f = en && X.FUNKCE[en];
  return f ? `${X.nazevFunkce(en, j)}: ${f.popis.replace(/\.$/, '').toLowerCase()} (${sez(a)})` : `volá neznámou funkci ${u.jmeno} – překlep?`;
}

/* strukturovaný odkaz slovy: Prodej[Cena] → „sloupec Cena tabulky Prodej“ */
function popisTab(u, EN) {
  const tab = u.tab ? (EN ? ` of table ${u.tab}` : ` tabulky ${u.tab}`) : '';
  const sl = u.sl1 ? (u.sl2 ? (EN ? `columns ${u.sl1}–${u.sl2}` : `sloupce ${u.sl1}–${u.sl2}`) : (EN ? `column ${u.sl1}` : `sloupec ${u.sl1}`)) : '';
  switch (u.cast) {
    case 'radek': return EN ? `${u.sl1 || 'the whole row'} from this row${tab}` : `${u.sl1 || 'celý řádek'} z tohoto řádku${tab}`;
    case 'vse': return EN ? `${sl || 'the whole table'}${tab} incl. headers` : `${sl || 'celá tabulka'}${tab} i se záhlavím`;
    case 'hlavicky': return EN ? `header row${sl ? ' of ' + sl : ''}${tab}` : `záhlaví${sl ? ' – ' + sl : ''}${tab}`;
    case 'souhrny': return EN ? `totals row${tab}` : `řádek souhrnů${tab}`;
    default: return sl ? sl + tab : (EN ? `data${tab}` : `data${tab}`);
  }
}
/* ukázková tabulka pro vzorec se strukturovanými odkazy: { bunky, tabulky, bunka } */
const TEXTOVE_SLOUPCE = /jm[eé]no|n[aá]zev|region|m[ěe]sto|zbo[žz][ií]|prodejce|k[oó]d|obchod|name|city|product|item|code|seller|store/i;
function ukazkoveTabulky(strom, seme = 1) {
  let s = seme >>> 0 || 1;
  const nahoda = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const tab = new Map();   /* NÁZEV → { nazev, sloupce: Set, radek: bool } */
  (function p(u) {
    if (!u) return;
    if (u.t === 'tab') {
      const jm = u.tab || 'Tabulka1', k = jm.toUpperCase();
      if (!tab.has(k)) tab.set(k, { nazev: jm, sloupce: new Set(), radek: false });
      const t = tab.get(k);
      [u.sl1, u.sl2].forEach(x => x && t.sloupce.add(x));
      if (u.cast === 'radek') t.radek = true;
    }
    (u.args || []).forEach(p); p(u.l); p(u.r); p(u.x);
  })(strom);
  const bunky = {}, tabulky = [];
  let c0 = 1, bunka = null;
  /* tabulka až za buňkami, na které vzorec odkazuje adresou (A1 apod.) */
  (function p(u) { if (!u) return; if (u.t === 'ref') c0 = Math.max(c0, u.c + 2); if (u.t === 'range') c0 = Math.max(c0, u.a.c + 2, u.b.c + 2); (u.args || []).forEach(p); p(u.l); p(u.r); p(u.x); })(strom);
  for (const t of tab.values()) {
    const sl = [...t.sloupce]; if (!sl.length) sl.push('Položka', 'Hodnota');
    if (t.radek) sl.push('Výsledek');
    sl.forEach((n, i) => {
      const c = c0 + i, text = TEXTOVE_SLOUPCE.test(n), mesto = /region|m[ěe]sto|city|obchod|store/i.test(n);
      bunky[X.adresa(1, c)] = n;
      for (let r = 2; r <= 6; r++) {
        if (n === 'Výsledek' && t.radek) continue;
        bunky[X.adresa(r, c)] = text ? (mesto ? MESTA : /zbo|product|item|k[oó]d|code/i.test(n) ? POLOZKY : JMENA)[(r + i) % 4] : String(Math.round(10 + nahoda() * 290));
      }
    });
    tabulky.push({ nazev: t.nazev, r1: 1, c1: c0, r2: 6, c2: c0 + sl.length - 1 });
    if (t.radek && !bunka) bunka = X.adresa(2, c0 + sl.length - 1);
    c0 += sl.length + 1;
  }
  return { bunky, tabulky, bunka, sloupcu: c0 - 1 };
}

/* postup: každá funkce = jeden krok; operátory se popíšou na místě */
function vysvetli(strom, j = 'cs') {
  const kroky = [], EN = anglicky(), hotove = new Map();   /* uzel → ⟦n⟧, ať se funkce popsaná dvakrát nezapíše jako dva kroky */
  function d(u, inline) {
    switch (u.t) {
      case 'num': return X.fmtCislo(u.v, j);
      case 'str': return u.v === '' ? (EN ? 'empty text ""' : 'prázdný text ""') : EN ? `“${u.v}”` : `„${u.v}“`;
      case 'bool': return lit(u.v, j);
      case 'err': return lit(new X.Chyba(u.v), j);
      case 'ref': return X.textRef(u);
      case 'range': return X.textRef(u.a) + ':' + X.textRef(u.b);
      case 'jmeno': return EN ? `“${u.v}” (unknown name!)` : `„${u.v}“ (neznámý název!)`;
      case 'tab': return inline || u.cast !== 'radek' ? X.textTab(u, j) : `${X.textTab(u, j)} (${popisTab(u, EN)})`;
      case 'prazdny': return '';
      case 'zav': return d(u.x, inline);
      case 'un': return u.op === '-' ? '−' + obal(u.x, 6, inline) : d(u.x, inline);
      case 'pct': return obal(u.x, 6, inline) + ' %';
      case 'op': {
        const p = PRIOR[u.op];
        if (SLOVA_POROVNANI[u.op]) return `${obal(u.l, p + 1, inline)} ${(EN ? POROVNANI_EN : SLOVA_POROVNANI)[u.op]} ${obal(u.r, p + 1, inline)}`;
        if (u.op === '&') return `${obal(u.l, p, inline)} ${EN ? 'joined with' : 'spojené s'} ${obal(u.r, p + 1, inline)}`;
        return `${obal(u.l, p, inline)} ${SYMBOLY[u.op]} ${obal(u.r, p + 1, inline)}`;
      }
      case 'fn': {
        if (!inline && hotove.has(u)) return hotove.get(u);
        /* vynechaný argument KDYŽ(podm;;x) Excel bere jako 0 */
        const a = u.args.map(x => (x.t === 'prazdny' ? (u.en === 'IF' ? '0' : '') : d(x, inline)));
        const veta = (EN ? vetaFunkceEn : vetaFunkce)(u, a, x => d(x, inline), j);
        if (inline) return `(${(u.en ? X.nazevFunkce(u.en, j) : u.jmeno)}: ${veta})`;
        kroky.push({ uzel: u, text: veta, nazev: u.en ? X.nazevFunkce(u.en, j) : u.jmeno });
        hotove.set(u, `⟦${kroky.length}⟧`);
        return hotove.get(u);
      }
    }
    return '';
  }
  function obal(u, minPr, inline) {
    let x = u; while (x.t === 'zav') x = x.x;
    const t = d(x, inline);
    return x.t === 'op' && PRIOR[x.op] < minPr ? `(${t})` : t;
  }
  const koren = d(strom, false);
  let root = strom; while (root.t === 'zav') root = root.x;
  if (root.t !== 'fn') {
    const NOP_EN = { '+': 'sum', '-': 'difference', '*': 'product', '/': 'quotient', '^': 'power', '&': 'joining text' };
    const nazev = EN ? (root.t === 'op' ? (NOP_EN[root.op] || 'comparison') : root.t === 'ref' ? 'reference' : 'value') : root.t === 'op' ? (NAZVY_OP[root.op] || 'porovnání') : root.t === 'ref' ? 'odkaz' : 'hodnota';
    const porov = root.t === 'op' && SLOVA_POROVNANI[root.op];
    kroky.push({ uzel: root, text: EN ? (porov ? `checks whether ${koren} → TRUE / FALSE` : `calculates ${koren}`) : (porov ? `porovná, zda ${koren} → PRAVDA / NEPRAVDA` : `spočítá ${koren}`), nazev });
  }
  const souhrn = (() => {
    const s0 = d(strom, true);
    const s = root.t === 'fn' ? s0.replace(/^\((.*)\)$/s, '$1') : s0;   /* vnější závorky jen kolem funkce, (A1+B1)*(C1+D1) zůstane */
    return s.length <= 260 ? s : null;
  })();
  return { kroky, souhrn };
}

/* ---------- rady ---------- */
function vzdalenost(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let jj = 1; jj <= n; jj++) d[0][jj] = jj;
  for (let i = 1; i <= m; i++) for (let jj = 1; jj <= n; jj++) d[i][jj] = Math.min(d[i - 1][jj] + 1, d[i][jj - 1] + 1, d[i - 1][jj - 1] + (a[i - 1] === b[jj - 1] ? 0 : 1));
  return d[m][n];
}
function podobneFunkce(jmeno, j) {
  const u = jmeno.toUpperCase();
  return Object.keys(X.ALIAS).map(k => [k, vzdalenost(u, k)]).filter(x => x[1] <= 2).sort((a, b) => a[1] - b[1]).slice(0, 3)
    .map(x => X.nazevFunkce(X.ALIAS[x[0]], j));
}
function rady(strom, j = 'cs') {
  const out = [];
  let refy = 0, hloubkaKdyz = 0, promenlive = false;
  const pridej = (typ, text) => { if (!out.some(r => r.text === text)) out.push({ typ, text }); };
  (function pruchod(u, rodic, hlKdyz, osetreno) {
    if (!u) return;
    if (u.t === 'ref' || u.t === 'range' || u.t === 'jmeno') refy++;
    if (u.t === 'fn' && ['TODAY', 'NOW', 'RAND', 'RANDBETWEEN'].includes(u.en)) promenlive = true;
    if (u.t === 'fn' && ['IF', 'IFERROR', 'IFNA', 'IFS'].includes(u.en)) osetreno = true;   /* dělení uvnitř bývá už ošetřené */
    if (u.t === 'jmeno') pridej('chyba', `„${u.v}“ není funkce ani adresa → chyba ${X.CHYBY.NAME[j]}. Je-li to text, dejte ho do uvozovek: "${u.v}".`);
    if (u.t === 'fn' && !u.en) {
      const p = podobneFunkce(u.jmeno, j);
      pridej('chyba', `Funkce ${u.jmeno} neexistuje${p.length ? ` – nemysleli jste ${p.join(' / ')}?` : ''} Výsledek bude ${X.CHYBY.NAME[j]}.`);
    }
    if (u.t === 'fn' && u.en) {
      const f = X.FUNKCE[u.en], n = u.args.length;
      if (n < f.min || n > f.max) pridej('chyba', `${X.nazevFunkce(u.en, j)} potřebuje ${f.min === f.max ? f.min : `${f.min} až ${f.max === 255 ? 'mnoho' : f.max}`} argumentů, má ${n}.`);
      const posl = (i) => u.args[i];
      if ((u.en === 'VLOOKUP' || u.en === 'HLOOKUP') && (!posl(3) || posl(3).t === 'prazdny'))
        pridej('pozor', `${X.nazevFunkce(u.en, j)} bez 4. argumentu hledá PŘIBLIŽNĚ. U kódů, jmen a čísel dokladů to tiše vrací špatné řádky – doplňte ${X.literal(false, j)}.`);
      if (u.en === 'MATCH' && (!posl(2) || posl(2).t === 'prazdny'))
        pridej('pozor', `${X.nazevFunkce('MATCH', j)} bez 3. argumentu hledá přibližně – pro přesnou shodu doplňte 0.`);
      if (u.en === 'VLOOKUP' && posl(2) && posl(2).t === 'num' && posl(1) && posl(1).t === 'range' && posl(2).v > Math.abs(posl(1).b.c - posl(1).a.c) + 1)
        pridej('chyba', `Tabulka ${X.textRef(posl(1).a)}:${X.textRef(posl(1).b)} má jen ${Math.abs(posl(1).b.c - posl(1).a.c) + 1} sloupců, ale chcete ${posl(2).v}. → ${X.CHYBY.REF[j]}`);
      if (u.en === 'SUM' && n === 1 && u.args[0].t === 'op' && u.args[0].op === '+')
        pridej('tip', `${X.nazevFunkce('SUM', j)} kolem sčítání je zbytečná: stačí samotné sčítání, nebo ${X.nazevFunkce('SUM', j)} s oblastí.`);
      if (['COUNTIF', 'SUMIF', 'AVERAGEIF'].includes(u.en) && u.args[1] && u.args[1].t === 'str' && /^(<=|>=|<>|<|>|=)\$?[A-Za-z]{1,3}\$?\d+$/.test(u.args[1].v))
        pridej('chyba', `Kritérium "${u.args[1].v}" porovnává s TEXTEM „${u.args[1].v.replace(/^[<>=]+/, '')}“, ne s buňkou. Správně: "${u.args[1].v.match(/^[<>=]+/)[0]}"&${u.args[1].v.replace(/^[<>=]+/, '')}`);
      if (u.en === 'IF') hlKdyz++;
      if (u.en === 'IFERROR') pridej('tip', `${X.nazevFunkce('IFERROR', j)} schová každou chybu, i překlep. Kde jde chybě předejít podmínkou (třeba dělení nulou), je to přehlednější.`);
    }
    if (u.t === 'op') {
      if (SLOVA_POROVNANI[u.op] && u.l.t === 'op' && SLOVA_POROVNANI[u.l.op])
        pridej('chyba', `Řetězené porovnání (jako 1 < x < 10) Excel nepočítá jako matematika: nejdřív vznikne PRAVDA/NEPRAVDA a ta se porovná dál. Použijte ${X.nazevFunkce('AND', j)}(…; …).`);
      if (u.op === '/' && !osetreno && (u.r.t === 'ref' || u.r.t === 'fn'))
        pridej('tip', `Dělení: když bude dělitel prázdný nebo 0, vznikne ${X.CHYBY.DIV0[j]}. Ošetřit jde přes ${X.nazevFunkce('IF', j)}(dělitel=0; …) nebo ${X.nazevFunkce('IFERROR', j)}.`);
      if ('*/'.includes(u.op) && [u.l, u.r].some(x => x.t === 'num' && ![0, 1, 2, 10, 100, 1000, 12, 24, 60].includes(x.v)))
        pridej('tip', `Číslo ${X.fmtCislo([u.l, u.r].find(x => x.t === 'num' && ![0, 1, 2, 10, 100, 1000, 12, 24, 60].includes(x.v)).v, j)} je zapsané přímo ve vzorci. Když se změní (sazba, kurz…), budete přepisovat všechny vzorce – dejte ho raději do buňky a odkazujte na ni s $.`);
    }
    hloubkaKdyz = Math.max(hloubkaKdyz, hlKdyz);
    for (const x of (u.args || [])) pruchod(x, u, hlKdyz, osetreno);
    if (u.l) pruchod(u.l, u, hlKdyz, osetreno); if (u.r) pruchod(u.r, u, hlKdyz, osetreno); if (u.x) pruchod(u.x, u, hlKdyz, osetreno);
  })(strom, null, 0, false);
  if (hloubkaKdyz >= 3) pridej('tip', `${hloubkaKdyz}× vnořené ${X.nazevFunkce('IF', j)} se špatně čte. Zvažte ${X.nazevFunkce('IFS', j)}, nebo tabulku hranic a ${X.nazevFunkce('VLOOKUP', j)} s přibližnou shodou.`);
  if (!refy && !promenlive) pridej('tip', 'Vzorec neobsahuje žádný odkaz na buňku – výsledek se nikdy nezmění. V tabulce se obvykle počítá s buňkami.');
  return out;
}

/* ---------- ukázková data ---------- */
const JMENA = ['Jan Novák', 'Petra Svobodová', 'Ota Kos', 'Marie Dvořáková', 'Karel Černý', 'Eva Malá', 'Tomáš Veselý', 'Lucie Horáková'];
const MESTA = ['Praha', 'Brno', 'Ostrava', 'Plzeň'];
const POLOZKY = ['Pero', 'Sešit', 'Guma', 'Lepidlo', 'Pravítko', 'Fixa', 'Blok', 'Kružítko'];
function ukazkovaData(strom, seme = 1) {
  let s = seme >>> 0 || 1;
  const nahoda = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cislo = (a, b) => Math.round(a + nahoda() * (b - a));
  const bunky = {};
  const nastav = (a, v) => { if (!(a in bunky)) bunky[a] = String(v); };
  const oblastAdres = u => {
    if (u.t === 'ref') return [[X.adresa(u.r, u.c)]];
    const r1 = Math.min(u.a.r, u.b.r), r2 = Math.min(Math.max(u.a.r, u.b.r), r1 + 39), c1 = Math.min(u.a.c, u.b.c), c2 = Math.min(Math.max(u.a.c, u.b.c), c1 + 11);
    const out = []; for (let r = r1; r <= r2; r++) { const radek = []; for (let c = c1; c <= c2; c++) radek.push(X.adresa(r, c)); out.push(radek); } return out;
  };
  const datum = (rok = 2026) => `${cislo(1, 28)}. ${cislo(1, 12)}. ${rok}`;
  const vyplnTyp = (u, typ, extra) => {
    if (!u || (u.t !== 'ref' && u.t !== 'range')) return;
    oblastAdres(u).flat().forEach((a, i) => {
      if (typ === 'text') nastav(a, JMENA[i % JMENA.length]);
      else if (typ === 'datum') nastav(a, datum(extra));
      else if (typ === 'kategorie') { const k = [extra, ...MESTA.filter(m => m !== extra)]; nastav(a, k[(i * 3 + cislo(0, 2)) % k.length]); }
      else if (typ === 'logika') nastav(a, nahoda() < 0.5 ? 'PRAVDA' : 'NEPRAVDA');
      else if (typ === 'ano') nastav(a, nahoda() < 0.6 ? extra : 'ne');
      else nastav(a, cislo(extra?.[0] ?? 10, extra?.[1] ?? 500));
    });
  };
  const kritHodnota = k => {
    if (!k) return null;
    if (k.t === 'num') return { typ: 'cislo', rozsah: [Math.max(0, k.v - 5), k.v + 5] };
    if (k.t === 'str') {
      const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(k.v), h = m[2].replace(/[*?]/g, '');
      if (/^-?\d+([.,]\d+)?$/.test(m[2])) { const n = parseFloat(m[2].replace(',', '.')); return { typ: 'cislo', rozsah: [Math.round(n * 0.4), Math.round(n * 1.6) || 10] }; }
      return { typ: 'kategorie', hodnota: h || 'Praha' };
    }
    return null;
  };
  const tabulka = (u, pribl, klicRef, sloupcove = true) => {
    if (!u || u.t !== 'range') return;
    const h = oblastAdres(u), rows = sloupcove ? h : h[0].map((_, c) => h.map(r => r[c]));
    rows.forEach((radek, i) => radek.forEach((a, c) => {
      if (c === 0) nastav(a, pribl ? [0, 1000, 5000, 10000, 20000, 50000][i] ?? 50000 + i * 10000 : `K${String(i + 1).padStart(2, '0')}`);
      else if (c === 1 && !pribl) nastav(a, POLOZKY[i % POLOZKY.length]);
      else nastav(a, pribl ? [0, 0.05, 0.1, 0.15, 0.2, 0.25][i] ?? 0.3 : cislo(10, 400));
    }));
    if (klicRef && klicRef.t === 'ref') nastav(X.adresa(klicRef.r, klicRef.c), pribl ? cislo(1500, 15000) : `K${String(Math.min(2, rows.length)).padStart(2, '0')}`);
  };
  const TEXTOVE = { LEFT: [0], RIGHT: [0], MID: [0], LEN: [0], UPPER: [0], LOWER: [0], PROPER: [0], TRIM: [0], FIND: [1], SEARCH: [1], SUBSTITUTE: [0], CONCAT: 'vse', CONCATENATE: 'vse', TEXTJOIN: 'od2', ISTEXT: [0] };
  const DATUMOVE = { YEAR: [0], MONTH: [0], DAY: [0], WEEKDAY: [0], EOMONTH: [0] };
  (function pruchod(u) {
    if (!u) return;
    if (u.t === 'fn' && u.en) {
      const a = u.args, en = u.en;
      if (en === 'VLOOKUP' || en === 'HLOOKUP') { const pr = !a[3] || a[3].t === 'prazdny' || (a[3].t === 'bool' && a[3].v) || (a[3].t === 'num' && a[3].v !== 0); tabulka(a[1], pr, a[0], en === 'VLOOKUP'); }
      if (en === 'MATCH' || en === 'XLOOKUP') {
        if (a[1] && a[1].t === 'range') oblastAdres(a[1]).flat().forEach((ad, i) => nastav(ad, POLOZKY[i % POLOZKY.length]));
        if (a[0] && a[0].t === 'ref') nastav(X.adresa(a[0].r, a[0].c), POLOZKY[1]);
        if (en === 'XLOOKUP') vyplnTyp(a[2], 'cislo');
      }
      if (['COUNTIF', 'SUMIF', 'AVERAGEIF'].includes(en)) { const k = kritHodnota(a[1]); if (k) vyplnTyp(a[0], k.typ, k.typ === 'cislo' ? k.rozsah : k.hodnota); }
      if (['COUNTIFS', 'SUMIFS', 'AVERAGEIFS', 'MAXIFS', 'MINIFS'].includes(en)) for (let i = en === 'COUNTIFS' ? 0 : 1; i + 1 < a.length; i += 2) { const k = kritHodnota(a[i + 1]); if (k) vyplnTyp(a[i], k.typ, k.typ === 'cislo' ? k.rozsah : k.hodnota); }
      const t = TEXTOVE[en];
      if (t) a.forEach((x, i) => { if (t === 'vse' || (t === 'od2' && i >= 2) || (Array.isArray(t) && t.includes(i))) vyplnTyp(x, 'text'); });
      if (en === 'TEXT' && a[1] && a[1].t === 'str' && /[dmy]/i.test(a[1].v) && !/0/.test(a[1].v)) vyplnTyp(a[0], 'datum');
      const dt = DATUMOVE[en]; if (dt) dt.forEach(i => vyplnTyp(a[i], 'datum'));
      /* od–do: začátek dřív než konec, jinak DATEDIF vrátí #NUM! */
      if (en === 'DATEDIF' || en === 'NETWORKDAYS') { vyplnTyp(a[0], 'datum', 2024); vyplnTyp(a[1], 'datum', 2026); }
      if (en === 'AND' || en === 'OR' || en === 'NOT') a.forEach(x => vyplnTyp(x, 'logika'));
    }
    if (u.t === 'op') {
      if (SLOVA_POROVNANI[u.op]) {
        if (u.r.t === 'str') vyplnTyp(u.l, u.op === '=' || u.op === '<>' ? 'ano' : 'text', u.r.v);
        if (u.l.t === 'str') vyplnTyp(u.r, u.op === '=' || u.op === '<>' ? 'ano' : 'text', u.l.v);
        if (u.r.t === 'num') vyplnTyp(u.l, 'cislo', [Math.max(0, Math.round(u.r.v * 0.5)), Math.round(u.r.v * 1.5) || 10]);
      }
      /* ">"&F1 je kritérium – F1 má být číslo, ne jméno */
      if (u.op === '&') { if (u.l.t === 'str' && /^(<=|>=|<>|<|>|=)$/.test(u.l.v)) vyplnTyp(u.r, 'cislo', [10, 300]); else [u.l, u.r].forEach(x => vyplnTyp(x, 'text')); }
    }
    (u.args || []).forEach(pruchod); pruchod(u.l); pruchod(u.r); pruchod(u.x);
  })(strom);
  /* zbytek odkazů = čísla */
  (function ostatni(u) {
    if (!u) return;
    if (u.t === 'ref' || u.t === 'range') vyplnTyp(u, 'cislo');
    (u.args || []).forEach(ostatni); ostatni(u.l); ostatni(u.r); ostatni(u.x);
  })(strom);
  return bunky;
}
/* kam vzorec postavit: vpravo od všech odkazů */
function bunkaProVzorec(strom) {
  let maxC = 0, minR = Infinity;
  (function p(u) {
    if (!u) return;
    if (u.t === 'ref') { maxC = Math.max(maxC, u.c); minR = Math.min(minR, u.r); }
    if (u.t === 'range') { maxC = Math.max(maxC, u.a.c, u.b.c); minR = Math.min(minR, u.a.r, u.b.r); }
    (u.args || []).forEach(p); p(u.l); p(u.r); p(u.x);
  })(strom);
  return X.adresa(minR === Infinity ? 1 : minR, Math.max(1, maxC + 2));   /* vpravo od všech odkazů – jinak by vznikl cyklus */
}

koren.XLV_ROZBOR = { anglicky, rozpoznej, vysvetli, rady, ukazkovaData, ukazkoveTabulky, bunkaProVzorec, popisKriteria };
})(typeof window !== 'undefined' ? window : globalThis);
