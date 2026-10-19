/* Generátor testovacích dat – výpočetní jádro bez DOM.
 *
 * Obsah:
 *  - deterministický PRNG sfc32 se seedem z hashe cyrb128; každý sloupec má vlastní
 *    podproud odvozený z (seed, tabulka, sloupec, účel) → změna jednoho sloupce
 *    nemění hodnoty ostatních,
 *  - malý jazyk výrazů (závislá pole, podmínky) – vlastní parser, žádné eval,
 *  - generátory hodnot (čísla, datumy, text, UUID, boolean, výčet, jména, e-maily,
 *    telefony, adresy, vzory, vzorce, cizí klíče),
 *  - kontrola schématu, topologické řazení tabulek i sloupců s detekcí cyklu,
 *  - dávkový generátor (Generator.krok), statistiky, kontrola referenční integrity,
 *  - exporty CSV / JSON / JSONL / SQL (SQLite, PostgreSQL) po kouscích (pro Blob).
 */
(function (koren) {
  'use strict';
  const SL = (typeof module !== 'undefined' && module.exports) ? require('./slovniky.js') : koren.TDSlovniky;

  const MAX_RADKU_TABULKA = 1000000;
  const MAX_RADKU_CELKEM = 3000000;
  const LIMIT_POKUSU = 1000;

  /* ================= PRNG ================= */
  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }

  /* sfc32 (Chris Doty-Humphrey, PractRand) – vrací celé číslo 0 … 2^32−1. */
  function sfc32u(a, b, c, d) {
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      c = c + t | 0;
      return t >>> 0;
    };
  }

  /* Proud náhodných čísel pro danou „cestu“ (seed, tabulka, sloupec, účel). */
  function vytvorProud() {
    const klic = Array.prototype.map.call(arguments, String).join('\u001f');
    const h = cyrb128(klic);
    const g = sfc32u(h[0], h[1], h[2], h[3]);
    for (let i = 0; i < 15; i++) g();
    const r = () => g() / 4294967296;
    const p = {
      r,
      u53() { return ((g() >>> 11) * 4294967296 + g()) / 9007199254740992; },
      cele(a, b) {
        const n = b - a + 1;
        if (n <= 1) return a;
        return n <= 4294967296 ? a + Math.floor(r() * n) : a + Math.floor(p.u53() * n);
      },
      normal() {
        let u = 0; while (u === 0) u = r();
        const v = r();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      vyber(pole) { return pole[Math.floor(r() * pole.length)]; },
      sance(pp) { return r() < pp; },
    };
    return p;
  }

  /* ================= Pomocné ================= */
  const pad2 = n => (n < 10 ? '0' : '') + n;
  function bezDiakritiky(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function slug(s) {
    return bezDiakritiky(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function jeCislo(v) { return typeof v === 'number' && isFinite(v); }
  function naCislo(v, vychozi) {
    if (v === null || v === undefined || v === '') return vychozi;
    if (typeof v === 'number') return v;
    const n = Number(String(v).trim().replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }

  /* ---- datumy (UTC, bez časových pásem a letního času) ---- */
  const RE_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;
  const RE_DATUMCAS = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
  function dnyZData(s) {
    const m = RE_DATUMCAS.exec(String(s).trim());
    if (!m) return NaN;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1000 || mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return NaN;
    return Math.round(dt.getTime() / 86400000);
  }
  function sekZDatumCasu(s) {
    const m = RE_DATUMCAS.exec(String(s).trim());
    if (!m) return NaN;
    const dny = dnyZData(s);
    if (!isFinite(dny)) return NaN;
    const h = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, se = m[6] ? +m[6] : 0;
    if (h > 23 || mi > 59 || se > 59) return NaN;
    return dny * 86400 + h * 3600 + mi * 60 + se;
  }
  function dataZDnu(n) {
    const d = new Date(n * 86400000);
    return String(d.getUTCFullYear()).padStart(4, '0') + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function datumCasZSek(s) {
    const dny = Math.floor(s / 86400); let z = s - dny * 86400;
    const h = Math.floor(z / 3600); z -= h * 3600;
    const mi = Math.floor(z / 60); const se = z - mi * 60;
    return dataZDnu(dny) + ' ' + pad2(h) + ':' + pad2(mi) + ':' + pad2(se);
  }
  const jeDatumText = v => typeof v === 'string' && RE_DATUM.test(v);
  const jeDatumCasText = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(v);

  function zaokrouhli(x, n) {
    n = n || 0;
    if (!isFinite(x)) return x;
    const z = x < 0 ? -1 : 1;
    const v = Number(Math.round(Number(Math.abs(x) + 'e' + n)) + 'e-' + n);
    return z * v || 0;
  }

  /* ================= Chyby ================= */
  function ChybaVyrazu(zprava, pozice) { this.name = 'ChybaVyrazu'; this.message = zprava; this.pozice = pozice; }
  ChybaVyrazu.prototype = Object.create(Error.prototype);
  function ChybaGenerovani(zprava, info) { this.name = 'ChybaGenerovani'; this.message = zprava; this.info = info || {}; }
  ChybaGenerovani.prototype = Object.create(Error.prototype);
  function ChybaSchematu(chyby) {
    this.name = 'ChybaSchematu'; this.chyby = chyby;
    this.message = chyby.map(popisChyby).join('\n');
  }
  ChybaSchematu.prototype = Object.create(Error.prototype);
  function popisChyby(c) {
    return (c.tabulka ? c.tabulka + (c.sloupec ? '.' + c.sloupec : '') + ': ' : '') + c.zprava;
  }

  /* ================= Jazyk výrazů ================= */
  function tokenizuj(src) {
    const t = []; let i = 0;
    src = String(src);
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      const zbytek = src.slice(i);
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(zbytek);
        t.push({ t: 'num', v: parseFloat(m[0]), p: i }); i += m[0].length; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, s = '';
        while (j < src.length && src[j] !== c) {
          if (src[j] === '\\' && j + 1 < src.length) {
            const n = src[j + 1];
            if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(src.substr(j + 2, 4))) { s += String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)); j += 6; continue; }
            s += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n; j += 2;
          } else s += src[j++];
        }
        if (j >= src.length) throw new ChybaVyrazu('neukončený řetězec (chybí ' + c + ')', i);
        t.push({ t: 'str', v: s, p: i }); i = j + 1; continue;
      }
      const id = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(zbytek);
      if (id) { t.push({ t: 'id', v: id[0], p: i }); i += id[0].length; continue; }
      const op = /^(==|!=|<>|<=|>=|&&|\|\||[-+*/%<>!?:(),=])/.exec(zbytek);
      if (op) {
        let v = op[0]; if (v === '=') v = '=='; if (v === '<>') v = '!=';
        t.push({ t: 'op', v, p: i }); i += op[0].length; continue;
      }
      throw new ChybaVyrazu('neočekávaný znak „' + c + '“', i);
    }
    t.push({ t: 'konec', p: src.length });
    return t;
  }

  const PRIORITA = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };

  function parsujVyraz(src) {
    if (String(src).trim() === '') throw new ChybaVyrazu('prázdný výraz', 0);
    const tk = tokenizuj(src); let i = 0;
    const pe = () => tk[i];
    function ocekavej(v) {
      const x = pe();
      if (x.t !== 'op' || x.v !== v) throw new ChybaVyrazu('očekáváno „' + v + '“', x.p);
      i++;
    }
    function ternar() {
      const c = binar(1);
      if (pe().t === 'op' && pe().v === '?') {
        i++; const a = ternar(); ocekavej(':'); const b = ternar();
        return { t: 'tern', c, a, b };
      }
      return c;
    }
    function binar(minP) {
      let l = unar();
      for (;;) {
        const o = pe(); const p = o.t === 'op' ? PRIORITA[o.v] : undefined;
        if (p === undefined || p < minP) return l;
        i++;
        const r = binar(p + 1);
        l = { t: 'bin', op: o.v, a: l, b: r, p: o.p };
      }
    }
    function unar() {
      const o = pe();
      if (o.t === 'op' && (o.v === '!' || o.v === '-' || o.v === '+')) { i++; return { t: 'un', op: o.v, a: unar() }; }
      return prim();
    }
    function prim() {
      const x = pe();
      if (x.t === 'num') { i++; return { t: 'lit', v: x.v }; }
      if (x.t === 'str') { i++; return { t: 'lit', v: x.v }; }
      if (x.t === 'id') {
        i++;
        const low = x.v.toLowerCase();
        if (pe().t === 'op' && pe().v === '(') {
          i++; const args = [];
          if (!(pe().t === 'op' && pe().v === ')')) {
            for (;;) {
              args.push(ternar());
              if (pe().t === 'op' && pe().v === ',') { i++; continue; }
              break;
            }
          }
          ocekavej(')');
          return { t: 'fn', n: low, args, p: x.p };
        }
        if (low === 'true' || low === 'pravda') return { t: 'lit', v: true };
        if (low === 'false' || low === 'nepravda') return { t: 'lit', v: false };
        if (low === 'null') return { t: 'lit', v: null };
        return { t: 'id', n: x.v, p: x.p };
      }
      if (x.t === 'op' && x.v === '(') { i++; const v = ternar(); ocekavej(')'); return v; }
      if (x.t === 'konec') throw new ChybaVyrazu('výraz nečekaně končí', x.p);
      throw new ChybaVyrazu('neočekávané „' + x.v + '“', x.p);
    }
    const ast = ternar();
    if (pe().t !== 'konec') throw new ChybaVyrazu('nadbytečný text „' + (pe().v === undefined ? '' : pe().v) + '“', pe().p);
    return ast;
  }

  function pravdive(v) { return !(v === null || v === undefined || v === false || v === 0 || v === '' || (typeof v === 'number' && isNaN(v))); }
  function naText(v) { return v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v); }
  function numerika(v) { return typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'string' ? naCislo(v, NaN) : v; }
  function rovno(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return (a === null || a === undefined) && (b === null || b === undefined);
    if ((typeof a === 'number' || typeof a === 'boolean') && (typeof b === 'number' || typeof b === 'boolean')) return +a === +b;
    return String(a) === String(b);
  }
  function porovnej(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
    const x = naText(a), y = naText(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  function aritm(op, a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return null;
    const x = numerika(a), y = numerika(b);
    if (!isFinite(x) || !isFinite(y)) return null;
    switch (op) {
      case '-': return x - y;
      case '*': return x * y;
      case '/': return y === 0 ? null : x / y;
      case '%': return y === 0 ? null : x % y;
      default: return x + y;
    }
  }
  function datumPlus(d, n, jednotka) {
    if (d === null || d === undefined || n === null || n === undefined) return null;
    const s = String(d); const k = numerika(n); if (!isFinite(k)) return null;
    if (jednotka === 's' || s.length > 10) {
      const sek = sekZDatumCasu(s); if (!isFinite(sek)) return null;
      return datumCasZSek(sek + Math.round(jednotka === 's' ? k : k * 86400));
    }
    const dny = dnyZData(s); if (!isFinite(dny)) return null;
    return dataZDnu(dny + Math.round(k));
  }
  function castData(d, co) {
    if (d === null || d === undefined) return null;
    const dny = dnyZData(String(d)); if (!isFinite(dny)) return null;
    const dt = new Date(dny * 86400000);
    if (co === 'r') return dt.getUTCFullYear();
    if (co === 'm') return dt.getUTCMonth() + 1;
    if (co === 'd') return dt.getUTCDate();
    return ((dt.getUTCDay() + 6) % 7) + 1; // 1 = pondělí … 7 = neděle
  }

  /* Funkce výrazů: [minimum argumentů, maximum, implementace(args, prostředí)] */
  const FUNKCE = {
    zaokrouhli: [1, 2, a => { const x = numerika(a[0]); return a[0] === null || !isFinite(x) ? null : zaokrouhli(x, a.length > 1 ? numerika(a[1]) : 0); }, 'zaokrouhlí na n desetinných míst'],
    dolu: [1, 1, a => a[0] === null ? null : Math.floor(numerika(a[0])), 'zaokrouhlí dolů'],
    nahoru: [1, 1, a => a[0] === null ? null : Math.ceil(numerika(a[0])), 'zaokrouhlí nahoru'],
    abs: [1, 1, a => a[0] === null ? null : Math.abs(numerika(a[0])), 'absolutní hodnota'],
    min: [1, 99, a => { const v = a.filter(x => x !== null).map(numerika); return v.length ? Math.min.apply(null, v) : null; }, 'nejmenší z čísel'],
    max: [1, 99, a => { const v = a.filter(x => x !== null).map(numerika); return v.length ? Math.max.apply(null, v) : null; }, 'největší z čísel'],
    delka: [1, 1, a => a[0] === null ? null : naText(a[0]).length, 'délka textu'],
    mala: [1, 1, a => a[0] === null ? null : naText(a[0]).toLocaleLowerCase('cs'), 'malá písmena'],
    velka: [1, 1, a => a[0] === null ? null : naText(a[0]).toLocaleUpperCase('cs'), 'velká písmena'],
    spoj: [1, 99, a => a.map(naText).join(''), 'spojí texty (NULL = prázdný text)'],
    cast: [2, 3, a => { if (a[0] === null) return null; const s = naText(a[0]); const od = Math.max(1, numerika(a[1])) - 1; return a.length > 2 ? s.substr(od, Math.max(0, numerika(a[2]))) : s.substr(od); }, 'část textu od pozice (od 1), volitelně délka'],
    bez_diakritiky: [1, 1, a => a[0] === null ? null : bezDiakritiky(naText(a[0])), 'odstraní háčky a čárky'],
    slug: [1, 1, a => a[0] === null ? null : slug(naText(a[0])), 'text pro URL (malá písmena, pomlčky)'],
    prvni_neprazdny: [1, 99, a => { for (const x of a) if (x !== null && x !== undefined && x !== '') return x; return null; }, 'první hodnota, která není NULL'],
    datum_plus: [2, 2, a => datumPlus(a[0], a[1], 'd'), 'k datu (i datu s časem) přičte n dní'],
    datumcas_plus: [2, 2, a => datumPlus(a[0], a[1], 's'), 'k datu s časem přičte n sekund'],
    datum: [1, 1, a => a[0] === null ? null : (isFinite(dnyZData(naText(a[0]))) ? naText(a[0]).slice(0, 10) : null), 'datum bez času'],
    rok: [1, 1, a => castData(a[0], 'r'), 'rok z data'],
    mesic: [1, 1, a => castData(a[0], 'm'), 'měsíc z data (1–12)'],
    den: [1, 1, a => castData(a[0], 'd'), 'den v měsíci'],
    den_v_tydnu: [1, 1, a => castData(a[0], 'w'), 'den v týdnu (1 = pondělí … 7 = neděle)'],
    rozdil_dni: [2, 2, a => { if (a[0] === null || a[1] === null) return null; const x = dnyZData(naText(a[0])), y = dnyZData(naText(a[1])); return isFinite(x) && isFinite(y) ? x - y : null; }, 'počet dní mezi daty (první − druhé)'],
    nahodne: [2, 2, (a, P) => { const x = Math.ceil(numerika(a[0])), y = Math.floor(numerika(a[1])); return isFinite(x) && isFinite(y) && x <= y ? P.proud.cele(x, y) : null; }, 'náhodné celé číslo v rozsahu (včetně mezí)'],
    nahodne_des: [2, 3, (a, P) => { const x = numerika(a[0]), y = numerika(a[1]); if (!isFinite(x) || !isFinite(y)) return null; return zaokrouhli(x + P.proud.r() * (y - x), a.length > 2 ? numerika(a[2]) : 2); }, 'náhodné desetinné číslo (výchozí 2 desetinná místa)'],
    vyber: [1, 99, (a, P) => P.proud.vyber(a), 'náhodně vybere jeden z argumentů'],
    sance: [1, 1, (a, P) => P.proud.r() < numerika(a[0]), 'pravda s pravděpodobností p (0–1)'],
    radek: [0, 0, (a, P) => P.ctx.index + 1, 'pořadí řádku (od 1)'],
    text: [1, 1, a => a[0] === null ? null : naText(a[0]), 'převod na text'],
    cislo: [1, 1, a => { if (a[0] === null) return null; const n = numerika(a[0]); return isFinite(n) ? n : null; }, 'převod na číslo'],
    doplnit: [2, 3, a => a[0] === null ? null : naText(a[0]).padStart(numerika(a[1]), a.length > 2 ? naText(a[2]) || '0' : '0'), 'doplní zleva na délku n (výchozí znak 0)'],
    kdyz: [3, 3, null, 'když(podmínka, ano, ne)'],
    nadrazeny: [2, 2, null, 'nadrazeny(cizí_klíč, "sloupec") – hodnota z odkazovaného řádku'],
  };

  /* Seznam závislostí (identifikátorů sloupců) ve výrazu. */
  function zavislostiVyrazu(ast, vystup) {
    vystup = vystup || [];
    if (!ast) return vystup;
    if (ast.t === 'id') { if (vystup.indexOf(ast.n) < 0) vystup.push(ast.n); }
    else if (ast.t === 'un') zavislostiVyrazu(ast.a, vystup);
    else if (ast.t === 'bin') { zavislostiVyrazu(ast.a, vystup); zavislostiVyrazu(ast.b, vystup); }
    else if (ast.t === 'tern') { zavislostiVyrazu(ast.c, vystup); zavislostiVyrazu(ast.a, vystup); zavislostiVyrazu(ast.b, vystup); }
    else if (ast.t === 'fn') ast.args.forEach(x => zavislostiVyrazu(x, vystup));
    return vystup;
  }

  /* Statická kontrola výrazu: neznámé funkce, počet argumentů, neznámé sloupce.
     prostredi: { sloupce: Set(jmen), nadrazeny(fk, sloupec) → null | text chyby } */
  function zkontrolujVyraz(ast, prostredi) {
    const chyby = [];
    (function jdi(n) {
      if (!n) return;
      if (n.t === 'id') { if (!prostredi.sloupce.has(n.n)) chyby.push('neznámý sloupec „' + n.n + '“'); return; }
      if (n.t === 'un') return jdi(n.a);
      if (n.t === 'bin') { jdi(n.a); jdi(n.b); return; }
      if (n.t === 'tern') { jdi(n.c); jdi(n.a); jdi(n.b); return; }
      if (n.t === 'fn') {
        const f = FUNKCE[n.n];
        if (!f) { chyby.push('neznámá funkce „' + n.n + '“'); return; }
        if (n.args.length < f[0] || n.args.length > f[1]) {
          chyby.push('funkce „' + n.n + '“ chce ' + (f[0] === f[1] ? f[0] : f[0] + '–' + f[1]) + ' argument(y), má ' + n.args.length);
          return;
        }
        if (n.n === 'nadrazeny') {
          if (n.args[0].t !== 'id') { chyby.push('nadrazeny(): první argument musí být název sloupce s cizím klíčem'); return; }
          if (n.args[1].t !== 'lit' || typeof n.args[1].v !== 'string') { chyby.push('nadrazeny(): druhý argument musí být název sloupce v uvozovkách'); return; }
          const ch = prostredi.nadrazeny ? prostredi.nadrazeny(n.args[0].n, n.args[1].v) : null;
          if (ch) chyby.push(ch);
          return;
        }
        n.args.forEach(jdi);
      }
    })(ast);
    return chyby;
  }

  /* Zkompiluje AST na funkci (ctx) → hodnota. kk = { indexSloupce(jmeno), proud, nadrazeny(fk, sl) → fn(ctx) } */
  function kompilujVyraz(ast, kk) {
    const P = { proud: kk.proud, ctx: null };
    function k(n) {
      switch (n.t) {
        case 'lit': { const v = n.v; return () => v; }
        case 'id': { const ix = kk.indexSloupce(n.n); return ctx => { const v = ctx.hodnoty[ix]; return v === undefined ? null : v; }; }
        case 'un': {
          const a = k(n.a);
          if (n.op === '!') return ctx => !pravdive(a(ctx));
          if (n.op === '-') return ctx => { const v = a(ctx); if (v === null) return null; const x = numerika(v); return isFinite(x) ? -x : null; };
          return ctx => { const v = a(ctx); if (v === null) return null; const x = numerika(v); return isFinite(x) ? x : null; };
        }
        case 'tern': { const c = k(n.c), a = k(n.a), b = k(n.b); return ctx => pravdive(c(ctx)) ? a(ctx) : b(ctx); }
        case 'bin': {
          const a = k(n.a), b = k(n.b);
          switch (n.op) {
            case '&&': return ctx => pravdive(a(ctx)) && pravdive(b(ctx));
            case '||': return ctx => pravdive(a(ctx)) || pravdive(b(ctx));
            case '==': return ctx => rovno(a(ctx), b(ctx));
            case '!=': return ctx => !rovno(a(ctx), b(ctx));
            case '<': return ctx => { const x = a(ctx), y = b(ctx); return x !== null && y !== null && porovnej(x, y) < 0; };
            case '<=': return ctx => { const x = a(ctx), y = b(ctx); return x !== null && y !== null && porovnej(x, y) <= 0; };
            case '>': return ctx => { const x = a(ctx), y = b(ctx); return x !== null && y !== null && porovnej(x, y) > 0; };
            case '>=': return ctx => { const x = a(ctx), y = b(ctx); return x !== null && y !== null && porovnej(x, y) >= 0; };
            case '+': return ctx => {
              const x = a(ctx), y = b(ctx);
              if (typeof x === 'string' || typeof y === 'string') return naText(x) + naText(y);
              return aritm('+', x, y);
            };
            default: { const op = n.op; return ctx => aritm(op, a(ctx), b(ctx)); }
          }
        }
        case 'fn': {
          if (n.n === 'kdyz') { const c = k(n.args[0]), a = k(n.args[1]), b = k(n.args[2]); return ctx => pravdive(c(ctx)) ? a(ctx) : b(ctx); }
          if (n.n === 'nadrazeny') return kk.nadrazeny(n.args[0].n, n.args[1].v);
          const f = FUNKCE[n.n][2]; const args = n.args.map(k);
          return ctx => { P.ctx = ctx; return f(args.map(g => g(ctx)), P); };
        }
      }
      throw new Error('neznámý uzel výrazu');
    }
    return k(ast);
  }

  /* ================= Vzory (uživatelské masky) ================= */
  const ZNAKY = {
    cislice: '0123456789'.split(''),
    velka: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split(''),
    hex: '0123456789abcdef'.split(''),
  };
  /* Syntaxe: # číslice, ? velké písmeno, * písmeno/číslice, [A-Z0-9] třída, (aa|bb) volba,
     {n} nebo {n,m} opakování předchozího prvku, \x doslovný znak. Ostatní znaky doslova. */
  function kompilujVzor(vz) {
    vz = String(vz);
    let i = 0;
    function chyba(z) { throw new ChybaVyrazu(z, i); }
    function sekvence(stop) {
      const prvky = [];
      while (i < vz.length && stop.indexOf(vz[i]) < 0) prvky.push(kvant(atom()));
      return prvky;
    }
    function atom() {
      const c = vz[i];
      if (c === '\\') { i++; if (i >= vz.length) chyba('vzor končí zpětným lomítkem'); return { lit: vz[i++] }; }
      if (c === '#') { i++; return { tr: ZNAKY.cislice }; }
      if (c === '?') { i++; return { tr: ZNAKY.velka }; }
      if (c === '*') { i++; return { tr: ZNAKY.alnum }; }
      if (c === '[') {
        i++; const zn = [];
        while (i < vz.length && vz[i] !== ']') {
          let a = vz[i];
          if (a === '\\') { i++; if (i >= vz.length) break; a = vz[i]; }
          i++;
          if (vz[i] === '-' && i + 1 < vz.length && vz[i + 1] !== ']') {
            i++; let b = vz[i]; if (b === '\\') { i++; b = vz[i]; } i++;
            const x = a.codePointAt(0), y = b.codePointAt(0);
            if (y < x) chyba('obrácený rozsah ' + a + '-' + b);
            if (y - x > 5000) chyba('příliš velký rozsah znaků');
            for (let k = x; k <= y; k++) zn.push(String.fromCodePoint(k));
          } else zn.push(a);
        }
        if (vz[i] !== ']') chyba('neuzavřená hranatá závorka [');
        i++;
        if (!zn.length) chyba('prázdná třída znaků []');
        return { tr: Array.from(new Set(zn)) };
      }
      if (c === '(') {
        i++; const alt = [sekvence('|)')];
        while (vz[i] === '|') { i++; alt.push(sekvence('|)')); }
        if (vz[i] !== ')') chyba('neuzavřená závorka (');
        i++;
        return { alt };
      }
      if (c === ')') chyba('nepárová závorka )');
      if (c === '{') chyba('opakování {…} bez předchozího prvku');
      i++;
      return { lit: c };
    }
    function kvant(a) {
      if (vz[i] !== '{') return a;
      const m = /^\{(\d+)(?:,(\d+))?\}/.exec(vz.slice(i));
      if (!m) chyba('chybný zápis opakování – použijte {n} nebo {n,m}');
      i += m[0].length;
      const min = +m[1], max = m[2] !== undefined ? +m[2] : min;
      if (max < min) chyba('v opakování {n,m} musí být n ≤ m');
      if (max > 1000) chyba('opakování nejvýše 1000×');
      return { opak: a, min, max };
    }
    const koren = sekvence('');
    if (i < vz.length) chyba('nepárový znak „' + vz[i] + '“');
    if (!koren.length) chyba('prázdný vzor');
    function gen(p, prvky) {
      let s = '';
      for (const x of prvky) s += genPrvek(p, x);
      return s;
    }
    function genPrvek(p, x) {
      if (x.lit !== undefined) return x.lit;
      if (x.tr) return x.tr[Math.floor(p.r() * x.tr.length)];
      if (x.alt) return gen(p, x.alt[Math.floor(p.r() * x.alt.length)]);
      const n = x.min === x.max ? x.min : p.cele(x.min, x.max);
      let s = ''; for (let k = 0; k < n; k++) s += genPrvek(p, x.opak);
      return s;
    }
    function kap(prvky) { let c = 1; for (const x of prvky) c *= kapPrvek(x); return c; }
    function kapPrvek(x) {
      if (x.lit !== undefined) return 1;
      if (x.tr) return x.tr.length;
      if (x.alt) return x.alt.reduce((s, a) => s + kap(a), 0);
      const b = kapPrvek(x.opak); let c = 0;
      for (let k = x.min; k <= x.max; k++) { c += Math.pow(b, k); if (c > 1e15) return Infinity; }
      return c;
    }
    return { generuj: p => gen(p, koren), kapacita: kap(koren) };
  }

  /* ================= Výčty ================= */
  function parsujVycet(text) {
    const radky = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(s => s !== '');
    const hodnoty = [], vahy = [];
    for (const r of radky) {
      const m = /^(.*?)\s*\|\s*(\d+(?:[.,]\d+)?)\s*$/.exec(r);
      if (m) { hodnoty.push(m[1]); vahy.push(Number(m[2].replace(',', '.'))); } else { hodnoty.push(r); vahy.push(1); }
    }
    const cisla = hodnoty.length > 0 && hodnoty.every(h => /^-?\d+(\.\d+)?$/.test(h));
    const vysl = cisla ? hodnoty.map(Number) : hodnoty.map(h => h === '\\N' ? null : h);
    return { hodnoty: vysl, vahy };
  }
  function vahovyVyber(vahy) {
    const kum = []; let s = 0;
    for (const v of vahy) { s += v; kum.push(s); }
    return function (p) {
      const x = p.r() * s; let lo = 0, hi = kum.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (kum[m] > x) hi = m; else lo = m + 1; }
      return lo;
    };
  }

  /* ================= Rozdělení ================= */
  /* Vrací reálné číslo v intervalu [min, max]. */
  function vzorekRozdeleni(p, d, min, max) {
    const roz = d.rozdeleni || 'rovnomerne';
    const sirka = max - min;
    if (roz === 'rovnomerne' || sirka <= 0) return min + p.r() * sirka;
    const stred = d.stred !== undefined && d.stred !== '' && isFinite(naCislo(d.stred)) ? naCislo(d.stred) : (min + max) / 2;
    const ods = d.odchylka !== undefined && d.odchylka !== '' && naCislo(d.odchylka) > 0 ? naCislo(d.odchylka) : sirka / 6;
    function vOrezu(f) {
      for (let k = 0; k < 30; k++) { const v = f(); if (v >= min && v <= max) return v; }
      return Math.min(max, Math.max(min, f()));
    }
    if (roz === 'normalni') return vOrezu(() => stred + ods * p.normal());
    if (roz === 'exponencialni') {
      const prumer = Math.max(1e-9, stred - min);
      return vOrezu(() => min - prumer * Math.log(1 - p.r()));
    }
    if (roz === 'lognormalni') {
      const median = Math.max(1e-9, stred - min);
      const tvar = d.tvar !== undefined && d.tvar !== '' && naCislo(d.tvar) > 0 ? naCislo(d.tvar) : 0.6;
      return vOrezu(() => min + Math.exp(Math.log(median) + tvar * p.normal()));
    }
    if (roz === 'trojuhelnikove') {
      const c = Math.min(max, Math.max(min, stred));
      const u = p.r(), f = (c - min) / sirka;
      return u < f ? min + Math.sqrt(u * sirka * (c - min)) : max - Math.sqrt((1 - u) * sirka * (max - c));
    }
    return min + p.r() * sirka;
  }

  /* ================= Katalog typů ================= */
  const TYPY = {
    sekvence: { nazev: 'Sekvence 1, 2, 3 …', skupina: 'Čísla' },
    cele: { nazev: 'Celé číslo', skupina: 'Čísla' },
    desetinne: { nazev: 'Desetinné číslo', skupina: 'Čísla' },
    datum: { nazev: 'Datum', skupina: 'Čas' },
    datumcas: { nazev: 'Datum a čas', skupina: 'Čas' },
    boolean: { nazev: 'Ano/ne (boolean)', skupina: 'Základní' },
    vycet: { nazev: 'Výčet hodnot (s vahami)', skupina: 'Základní' },
    text: { nazev: 'Text (výplňový)', skupina: 'Základní' },
    uuid: { nazev: 'UUID v4', skupina: 'Základní' },
    vzor: { nazev: 'Vlastní vzor (maska)', skupina: 'Základní' },
    jmeno: { nazev: 'Jméno osoby (syntetické)', skupina: 'Osoby a adresy', synteticke: true },
    email: { nazev: 'E-mail (example.com/.org/.net)', skupina: 'Osoby a adresy', synteticke: true },
    telefon: { nazev: 'Telefon (fiktivní rozsah)', skupina: 'Osoby a adresy', synteticke: true },
    adresa: { nazev: 'Adresa (smyšlená)', skupina: 'Osoby a adresy', synteticke: true },
    produkt: { nazev: 'Název výrobku', skupina: 'Osoby a adresy' },
    reference: { nazev: 'Cizí klíč (odkaz na tabulku)', skupina: 'Vazby a výpočty' },
    vzorec: { nazev: 'Vzorec / závislé pole', skupina: 'Vazby a výpočty' },
    null: { nazev: 'NULL (prázdná hodnota)', skupina: 'Vazby a výpočty', jenPravidlo: true },
  };

  const VYCHOZI = {
    sekvence: { start: 1, krok: 1 },
    cele: { min: 1, max: 100, rozdeleni: 'rovnomerne' },
    desetinne: { min: 0, max: 1000, des: 2, rozdeleni: 'rovnomerne' },
    datum: { od: '2020-01-01', do: '2025-12-31', rozdeleni: 'rovnomerne' },
    datumcas: { od: '2024-01-01 00:00:00', do: '2025-12-31 23:59:59', rozdeleni: 'rovnomerne' },
    boolean: { pravd: 50 },
    vycet: { hodnoty: 'A | 3\nB | 2\nC | 1' },
    text: { rezim: 'slova', min: 2, max: 6 },
    uuid: {},
    vzor: { vzor: 'ABC-####-??' },
    jmeno: { cast: 'cele', pohlavi: 'nahodne', sloupecPohlavi: '' },
    email: { zdroj: 'nahodny', sloupecJmeno: '', sloupecPrijmeni: '', domena: 'mix' },
    telefon: { format: 'cz0' },
    adresa: { cast: 'cela' },
    produkt: {},
    reference: { tabulka: '', sloupec: '', rozdeleni: 'rovnomerne', s: 1.1 },
    vzorec: { vyraz: '' },
    null: {},
  };

  function interpretujPohlavi(v, p) {
    if (v !== null && v !== undefined) {
      const s = String(v).trim().toLowerCase();
      if (/^(ž|z|f|w|žena|zena|female|woman)/.test(s)) return true;
      if (/^(m|muž|muz|male|man)/.test(s)) return false;
    }
    return p.r() < 0.5;
  }

  /* Zkompiluje generátor jednoho typu. kk = { proud(ucel), indexSloupce(jmeno), nadrazeny(fk, sl), reference(def) } */
  function kompilujGenerator(def, kk) {
    const p = kk.proud('hodnota');
    const typ = def.typ;
    switch (typ) {
      case 'null': return () => null;
      case 'sekvence': {
        const start = naCislo(def.start, 1), krok = naCislo(def.krok, 1);
        return ctx => start + ctx.index * krok;
      }
      case 'cele': {
        const min = Math.ceil(naCislo(def.min, 0)), max = Math.floor(naCislo(def.max, 100));
        if ((def.rozdeleni || 'rovnomerne') === 'rovnomerne') {
          if (kk.unikatni && max - min + 1 <= 4294967296) { const d = bezOpakovani(p, max - min + 1, vycerpano(kk, max - min + 1)); return () => min + d(); }
          return () => p.cele(min, max);
        }
        return () => Math.min(max, Math.max(min, Math.round(vzorekRozdeleni(p, def, min - 0.5, max + 0.5))));
      }
      case 'desetinne': {
        const min = naCislo(def.min, 0), max = naCislo(def.max, 1000), des = Math.max(0, Math.min(10, Math.round(naCislo(def.des, 2))));
        return () => Math.min(max, Math.max(min, zaokrouhli(vzorekRozdeleni(p, def, min, max), des)));
      }
      case 'datum': {
        const od = dnyZData(def.od), dO = dnyZData(def.do);
        if ((def.rozdeleni || 'rovnomerne') === 'rovnomerne') {
          if (kk.unikatni) { const d = bezOpakovani(p, dO - od + 1, vycerpano(kk, dO - od + 1)); return () => dataZDnu(od + d()); }
          return () => dataZDnu(p.cele(od, dO));
        }
        return () => dataZDnu(Math.min(dO, Math.max(od, Math.round(vzorekRozdeleni(p, prevedStred(def, dnyZData), od - 0.5, dO + 0.5)))));
      }
      case 'datumcas': {
        const od = sekZDatumCasu(def.od), dO = sekZDatumCasu(def.do);
        if ((def.rozdeleni || 'rovnomerne') === 'rovnomerne') {
          if (kk.unikatni) { const d = bezOpakovani(p, dO - od + 1, vycerpano(kk, dO - od + 1)); return () => datumCasZSek(od + d()); }
          return () => datumCasZSek(p.cele(od, dO));
        }
        return () => datumCasZSek(Math.min(dO, Math.max(od, Math.round(vzorekRozdeleni(p, prevedStred(def, sekZDatumCasu), od, dO)))));
      }
      case 'boolean': {
        const pr = Math.min(100, Math.max(0, naCislo(def.pravd, 50))) / 100;
        return () => p.r() < pr;
      }
      case 'vycet': {
        const v = parsujVycet(def.hodnoty); const vyb = vahovyVyber(v.vahy);
        if (kk.unikatni) {
          const ruzne = Array.from(new Set(v.hodnoty.filter((h, k) => v.vahy[k] > 0)));
          const d = bezOpakovani(p, ruzne.length, vycerpano(kk, ruzne.length));
          return () => ruzne[d()];
        }
        return () => v.hodnoty[vyb(p)];
      }
      case 'text': {
        const min = Math.max(0, Math.round(naCislo(def.min, 1))), max = Math.max(min, Math.round(naCislo(def.max, min)));
        const vety = def.rezim === 'vety';
        return () => {
          const n = p.cele(min, max); const casti = [];
          for (let k = 0; k < n; k++) {
            if (vety) {
              const m = p.cele(4, 12); const w = [];
              for (let j = 0; j < m; j++) w.push(p.vyber(SL.slova));
              const s = w.join(' '); casti.push(s.charAt(0).toLocaleUpperCase('cs') + s.slice(1) + '.');
            } else casti.push(p.vyber(SL.slova));
          }
          return casti.join(' ');
        };
      }
      case 'uuid': return () => uuid4(p);
      case 'vzor': { const v = kompilujVzor(def.vzor); return () => v.generuj(p); }
      case 'jmeno': {
        const zSloupce = def.pohlavi === 'sloupec' && def.sloupecPohlavi ? kk.indexSloupce(def.sloupecPohlavi) : -1;
        const cast = def.cast || 'cele';
        return ctx => {
          let zena;
          if (zSloupce >= 0) zena = interpretujPohlavi(ctx.hodnoty[zSloupce], p);
          else if (def.pohlavi === 'z') zena = true;
          else if (def.pohlavi === 'm') zena = false;
          else zena = p.r() < 0.5;
          const k = p.vyber(zena ? SL.zenska : SL.muzska);
          const pr = p.vyber(SL.prijmeni)[zena ? 1 : 0];
          return cast === 'krestni' ? k : cast === 'prijmeni' ? pr : k + ' ' + pr;
        };
      }
      case 'email': {
        const ij = def.zdroj === 'sloupce' && def.sloupecJmeno ? kk.indexSloupce(def.sloupecJmeno) : -1;
        const ip = def.zdroj === 'sloupce' && def.sloupecPrijmeni ? kk.indexSloupce(def.sloupecPrijmeni) : -1;
        const dom = SL.domeny.indexOf(def.domena) >= 0 ? [def.domena] : SL.domeny;
        return (ctx, pokus) => {
          const d = dom.length === 1 ? dom[0] : p.vyber(dom);
          let lok = '';
          if (ij >= 0 || ip >= 0) {
            const a = ij >= 0 ? slug(naText(ctx.hodnoty[ij])).replace(/-/g, '') : '';
            const b = ip >= 0 ? slug(naText(ctx.hodnoty[ip])).replace(/-/g, '') : '';
            lok = [a, b].filter(Boolean).join('.');
          }
          if (!lok) lok = slug(p.vyber(SL.slova)).replace(/-/g, '') + '.' + slug(p.vyber(SL.slova)).replace(/-/g, '') + p.cele(1, 999);
          else if (pokus > 0) lok += p.cele(2, 99 + pokus * 50);
          return lok + '@' + d;
        };
      }
      case 'telefon': {
        const f = def.format || 'cz0';
        const cisl = n => { let s = ''; for (let k = 0; k < n; k++) s += p.cele(0, 9); return s; };
        if (f === 'uk') return () => '+44 7700 900' + cisl(3);
        if (f === 'us') return () => '+1 ' + p.vyber(SL.usPredvolby) + ' 555 01' + cisl(2);
        return () => '+420 0' + cisl(2) + ' ' + cisl(3) + ' ' + cisl(3);
      }
      case 'adresa': {
        const cast = def.cast || 'cela';
        const ul = () => {
          const n = p.vyber(SL.ulice);
          return n + ' ' + (p.r() < 0.35 ? p.cele(100, 2999) + '/' + p.cele(1, 99) : p.cele(1, 250));
        };
        const ob = () => {
          if (p.r() < 0.25) return p.vyber(SL.obceSlozene);
          const z = p.vyber(SL.obceZaklad);
          return p.r() < 0.35 ? p.vyber(SL.predponyObci) + ' ' + z : z;
        };
        const psc = () => p.cele(1, 7) + '' + p.cele(0, 9) + p.cele(0, 9) + ' ' + p.cele(0, 9) + p.cele(0, 9);
        if (cast === 'ulice') return ul;
        if (cast === 'obec') return ob;
        if (cast === 'psc') return psc;
        return () => { const u = ul(), ps = psc(), o = ob(); return u + ', ' + ps + ' ' + o; };
      }
      case 'produkt': return () => {
        const [n, rod] = p.vyber(SL.podstatna); let a = p.vyber(SL.pridavna);
        if (a.endsWith('ý')) a = a.slice(0, -1) + (rod === 'f' ? 'á' : rod === 'n' ? 'é' : 'ý');
        let s = a.charAt(0).toLocaleUpperCase('cs') + a.slice(1) + ' ' + n;
        if (p.r() < 0.3) s += ' ' + p.vyber(SL.varianty);
        return s;
      };
      case 'vzorec': {
        const f = kompilujVyraz(parsujVyraz(def.vyraz), { indexSloupce: kk.indexSloupce, proud: p, nadrazeny: kk.nadrazeny });
        return ctx => { const v = f(ctx); return v === undefined || (typeof v === 'number' && !isFinite(v)) ? null : v; };
      }
      case 'reference': return kk.reference(def, p);
    }
    throw new ChybaGenerovani('neznámý typ „' + typ + '“');
  }

  function prevedStred(def, prevod) {
    const d = Object.assign({}, def);
    if (def.stred !== undefined && def.stred !== '') { const v = prevod(def.stred); d.stred = isFinite(v) ? v : undefined; }
    if (def.odchylka !== undefined && def.odchylka !== '') {
      const n = naCislo(def.odchylka, NaN);
      d.odchylka = isFinite(n) ? n * (prevod === sekZDatumCasu ? 86400 : 1) : undefined;
    }
    return d;
  }

  /* Výběr bez opakování z 0 … K−1 (líné Fisher–Yates přes Map) – unikátnost bez opakovaných pokusů. */
  function bezOpakovani(p, K, zpravaVycerpano) {
    const prohoz = new Map(); let i = 0;
    return function () {
      if (i >= K) throw new ChybaGenerovani(zpravaVycerpano());
      const j = p.cele(i, K - 1);
      const vj = prohoz.has(j) ? prohoz.get(j) : j;
      const vi = prohoz.has(i) ? prohoz.get(i) : i;
      prohoz.set(j, vi); prohoz.delete(i);
      i++;
      return vj;
    };
  }
  const vycerpano = (kk, K) => () => 'Sloupec „' + (kk.popis || '?') + '“: všech ' + K.toLocaleString('cs-CZ') + ' možných různých hodnot už bylo použito – pro unikátnost rozšiřte rozsah nebo snižte počet řádků.';

  function uuid4(p) {
    const h = '0123456789abcdef'; let s = '';
    for (let k = 0; k < 32; k++) {
      let x = Math.floor(p.r() * 16);
      if (k === 12) x = 4;
      else if (k === 16) x = 8 + (x & 3);
      s += h[x];
      if (k === 7 || k === 11 || k === 15 || k === 19) s += '-';
    }
    return s;
  }

  /* ================= Kontrola schématu ================= */
  function klicNazvu(s) { return String(s).trim().toLowerCase(); }

  /* Závislosti generátoru (jména sloupců téže tabulky). Hází ChybaVyrazu při chybném výrazu. */
  function zavislostiGeneratoru(def) {
    switch (def.typ) {
      case 'vzorec': return zavislostiVyrazu(parsujVyraz(def.vyraz));
      case 'jmeno': return def.pohlavi === 'sloupec' && def.sloupecPohlavi ? [def.sloupecPohlavi] : [];
      case 'email': return def.zdroj === 'sloupce' ? [def.sloupecJmeno, def.sloupecPrijmeni].filter(Boolean) : [];
      default: return [];
    }
  }

  /* Odhad počtu možných různých hodnot (pro kontrolu unikátnosti). */
  function kapacitaGeneratoru(def) {
    switch (def.typ) {
      case 'cele': return Math.floor(naCislo(def.max, 100)) - Math.ceil(naCislo(def.min, 0)) + 1;
      case 'desetinne': { const des = Math.max(0, Math.min(10, Math.round(naCislo(def.des, 2)))); return Math.floor((naCislo(def.max, 1000) - naCislo(def.min, 0)) * Math.pow(10, des)) + 1; }
      case 'datum': return dnyZData(def.do) - dnyZData(def.od) + 1;
      case 'datumcas': return sekZDatumCasu(def.do) - sekZDatumCasu(def.od) + 1;
      case 'boolean': { const pr = naCislo(def.pravd, 50); return pr <= 0 || pr >= 100 ? 1 : 2; }
      case 'vycet': { const v = parsujVycet(def.hodnoty); return new Set(v.hodnoty.filter((h, k) => v.vahy[k] > 0)).size; }
      case 'vzor': try { return kompilujVzor(def.vzor).kapacita; } catch (e) { return Infinity; }
      case 'jmeno': return def.cast === 'krestni' ? (def.pohlavi === 'z' || def.pohlavi === 'm' ? 50 : 100) : def.cast === 'prijmeni' ? 120 : 6000;
      case 'telefon': return def.format === 'uk' ? 1000 : def.format === 'us' ? 1000 : 1e8;
      case 'adresa': return def.cast === 'psc' ? 70000 : def.cast === 'obec' ? 100 : Infinity;
      case 'produkt': return SL.pridavna.length * SL.podstatna.length * (1 + SL.varianty.length);
      case 'null': return 0;
      default: return Infinity;
    }
  }

  function overGenerator(def, kontext, pridej) {
    const typ = def.typ;
    if (!TYPY[typ]) { pridej('neznámý typ „' + typ + '“'); return; }
    if (TYPY[typ].jenPravidlo && !kontext.vPravidle) { pridej('typ NULL lze použít jen v podmíněném pravidle – pro prázdný sloupec nastavte NULL 100 %'); return; }
    const cislo = (k, vych) => naCislo(def[k], vych);
    switch (typ) {
      case 'sekvence':
        if (!isFinite(cislo('start', 1)) || !isFinite(cislo('krok', 1))) pridej('začátek a krok sekvence musí být čísla');
        else if (cislo('krok', 1) === 0) pridej('krok sekvence nesmí být 0 (hodnoty by se opakovaly)');
        break;
      case 'cele': case 'desetinne': {
        const a = cislo('min', 0), b = cislo('max', 0);
        if (!isFinite(a) || !isFinite(b)) pridej('minimum a maximum musí být čísla');
        else if (a > b) pridej('minimum (' + a + ') je větší než maximum (' + b + ')');
        else if (typ === 'cele' && Math.ceil(a) > Math.floor(b)) pridej('v rozsahu není žádné celé číslo');
        else if (Math.abs(a) > 9007199254740991 || Math.abs(b) > 9007199254740991) pridej('rozsah překračuje bezpečná celá čísla (±2^53)');
        if (typ === 'desetinne') { const d = cislo('des', 2); if (!(d >= 0 && d <= 10)) pridej('počet desetinných míst musí být 0–10'); }
        overRozdeleni(def, pridej, false);
        break;
      }
      case 'datum': case 'datumcas': {
        const f = typ === 'datum' ? dnyZData : sekZDatumCasu;
        const a = f(def.od), b = f(def.do);
        const fmt = typ === 'datum' ? 'RRRR-MM-DD' : 'RRRR-MM-DD HH:MM:SS';
        if (!isFinite(a)) pridej('neplatné datum „od“ (formát ' + fmt + ')');
        if (!isFinite(b)) pridej('neplatné datum „do“ (formát ' + fmt + ')');
        if (isFinite(a) && isFinite(b) && a > b) pridej('datum „od“ je pozdější než „do“');
        if (def.rozdeleni && def.rozdeleni !== 'rovnomerne' && def.stred !== undefined && def.stred !== '' && !isFinite(f(def.stred))) pridej('střed rozdělení musí být datum (' + fmt + ')');
        overRozdeleni(def, pridej, true);
        break;
      }
      case 'boolean': { const pr = cislo('pravd', 50); if (!(pr >= 0 && pr <= 100)) pridej('pravděpodobnost „ano“ musí být 0–100 %'); break; }
      case 'vycet': {
        const v = parsujVycet(def.hodnoty);
        if (!v.hodnoty.length) pridej('výčet je prázdný – zadejte aspoň jednu hodnotu (jedna na řádek)');
        else if (v.vahy.reduce((s, x) => s + x, 0) <= 0) pridej('součet vah ve výčtu musí být kladný');
        break;
      }
      case 'text': {
        const a = cislo('min', 1), b = cislo('max', 1);
        if (!(a >= 0) || !(b >= 0) || a > b) pridej('počet slov/vět: min musí být ≤ max a nezáporné');
        else if (b > 1000) pridej('nejvýše 1000 slov/vět');
        break;
      }
      case 'vzor':
        try { kompilujVzor(def.vzor); } catch (e) { pridej('vzor: ' + e.message + (e.pozice !== undefined ? ' (znak ' + (e.pozice + 1) + ')' : '')); }
        break;
      case 'jmeno':
        if (def.pohlavi === 'sloupec' && !kontext.sloupce.has(def.sloupecPohlavi)) pridej('zvolte existující sloupec s pohlavím');
        break;
      case 'email':
        if (def.zdroj === 'sloupce') {
          if (!def.sloupecJmeno && !def.sloupecPrijmeni) pridej('zvolte sloupce se jménem/příjmením, nebo náhodný e-mail');
          [def.sloupecJmeno, def.sloupecPrijmeni].filter(Boolean).forEach(s => { if (!kontext.sloupce.has(s)) pridej('sloupec „' + s + '“ neexistuje'); });
        }
        break;
      case 'vzorec': {
        let ast;
        try { ast = parsujVyraz(def.vyraz); } catch (e) { pridej('výraz: ' + e.message + (e.pozice !== undefined ? ' (znak ' + (e.pozice + 1) + ')' : '')); break; }
        zkontrolujVyraz(ast, kontext).forEach(z => pridej('výraz: ' + z));
        break;
      }
      case 'reference': {
        if (kontext.vPravidle) { pridej('cizí klíč nelze použít v podmíněném pravidle'); break; }
        const t = kontext.najdiTabulku(def.tabulka);
        if (!t) { pridej('odkazovaná tabulka „' + (def.tabulka || '') + '“ neexistuje'); break; }
        const s = (t.sloupce || []).find(x => x.nazev === def.sloupec);
        if (!s) { pridej('odkazovaný sloupec „' + t.nazev + '.' + (def.sloupec || '') + '“ neexistuje'); break; }
        if (!s.pk && !s.unikatni) pridej('odkazovaný sloupec „' + t.nazev + '.' + s.nazev + '“ musí být primární klíč nebo unikátní');
        if (naCislo(s.nullP, 0) > 0) pridej('odkazovaný sloupec „' + t.nazev + '.' + s.nazev + '“ smí obsahovat NULL – cizí klíč by mohl odkazovat na nic');
        if (def.rozdeleni === 'zipf' && !(naCislo(def.s, 1.1) > 0 && naCislo(def.s, 1.1) <= 5)) pridej('exponent Zipfova rozdělení musí být v rozsahu (0; 5]');
        break;
      }
    }
  }

  function overRozdeleni(def, pridej, datum) {
    const r = def.rozdeleni || 'rovnomerne';
    if (['rovnomerne', 'normalni', 'exponencialni', 'lognormalni', 'trojuhelnikove'].indexOf(r) < 0) { pridej('neznámé rozdělení „' + r + '“'); return; }
    if (r === 'rovnomerne') return;
    if (!datum && def.stred !== undefined && def.stred !== '' && !isFinite(naCislo(def.stred))) pridej('střed rozdělení musí být číslo');
    if (def.odchylka !== undefined && def.odchylka !== '' && !(naCislo(def.odchylka) > 0)) pridej('směrodatná odchylka musí být kladné číslo');
    if (!datum && (r === 'exponencialni' || r === 'lognormalni') && def.stred !== undefined && def.stred !== '' && naCislo(def.stred) <= naCislo(def.min, 0)) pridej('u exponenciálního/lognormálního rozdělení musí být střed (průměr/medián) větší než minimum');
  }

  /* Topologické řazení (Kahn, stabilní podle původního pořadí). hrany: uzel → [na čem závisí]. */
  function topoRazeni(uzly, zavisi) {
    const stupen = new Map(uzly.map(u => [u, 0]));
    const nasl = new Map(uzly.map(u => [u, []]));
    for (const u of uzly) for (const d of (zavisi.get(u) || [])) {
      if (!stupen.has(d) || d === u) continue;
      stupen.set(u, stupen.get(u) + 1); nasl.get(d).push(u);
    }
    const vysl = []; const hotovo = new Set();
    for (;;) {
      const u = uzly.find(x => !hotovo.has(x) && stupen.get(x) === 0);
      if (u === undefined) break;
      hotovo.add(u); vysl.push(u);
      for (const v of nasl.get(u)) stupen.set(v, stupen.get(v) - 1);
    }
    if (vysl.length === uzly.length) return { poradi: vysl, cyklus: null };
    // najdi cyklus mezi zbylými uzly (DFS)
    const zbyle = new Set(uzly.filter(u => !hotovo.has(u)));
    const stav = new Map(); const zasobnik = [];
    let cyklus = null;
    function dfs(u) {
      stav.set(u, 1); zasobnik.push(u);
      for (const d of (zavisi.get(u) || [])) {
        if (!zbyle.has(d) || d === u || cyklus) continue;
        if (stav.get(d) === 1) { cyklus = zasobnik.slice(zasobnik.indexOf(d)).concat([d]); return; }
        if (!stav.has(d)) dfs(d);
        if (cyklus) return;
      }
      stav.set(u, 2); zasobnik.pop();
    }
    for (const u of zbyle) { if (!stav.has(u)) dfs(u); if (cyklus) break; }
    return { poradi: vysl, cyklus: cyklus ? cyklus.reverse() : Array.from(zbyle) };
  }

  /* Kontrola celého schématu. Vrací { chyby, varovani, poradi (názvy tabulek), poradiSloupcu: {tab: [jména]} }. */
  function zkontrolujSchema(schema) {
    const chyby = [], varovani = [];
    const tabulky = (schema && Array.isArray(schema.tabulky)) ? schema.tabulky : [];
    if (!tabulky.length) chyby.push({ zprava: 'schéma neobsahuje žádnou tabulku' });
    const podleKlice = new Map();
    tabulky.forEach((t, ti) => {
      const n = String(t.nazev || '').trim();
      if (!n) chyby.push({ tabulka: '#' + (ti + 1), zprava: 'tabulka nemá název' });
      else if (/[\u0000-\u001f]/.test(n) || n.length > 63) chyby.push({ tabulka: n, zprava: 'název tabulky musí mít 1–63 znaků bez řídicích znaků' });
      else if (podleKlice.has(klicNazvu(n))) chyby.push({ tabulka: n, zprava: 'název tabulky je použit vícekrát (bez ohledu na velikost písmen)' });
      else podleKlice.set(klicNazvu(n), t);
    });
    const najdiTabulku = n => tabulky.find(t => t.nazev === n) || null;
    const zavisiTab = new Map();
    const poradiSloupcu = {};
    const odhadPevny = new Map();

    for (const t of tabulky) {
      const tn = String(t.nazev || '').trim();
      const pridejT = z => chyby.push({ tabulka: tn, zprava: z });
      const sloupce = Array.isArray(t.sloupce) ? t.sloupce : [];
      if (!sloupce.length) pridejT('tabulka nemá žádný sloupec');
      const jmena = new Set(); const klice = new Set();
      sloupce.forEach((s, si) => {
        const n = String(s.nazev || '').trim();
        if (!n) chyby.push({ tabulka: tn, sloupec: '#' + (si + 1), zprava: 'sloupec nemá název' });
        else if (/[\u0000-\u001f]/.test(n) || n.length > 63) chyby.push({ tabulka: tn, sloupec: n, zprava: 'název sloupce musí mít 1–63 znaků bez řídicích znaků' });
        else if (klice.has(klicNazvu(n))) chyby.push({ tabulka: tn, sloupec: n, zprava: 'název sloupce je v tabulce vícekrát' });
        klice.add(klicNazvu(n)); jmena.add(n);
      });
      // počet řádků
      const rezim = t.rezimRadku || 'pevny';
      let odhad = 0;
      if (rezim === 'pevny') {
        const r = naCislo(t.radky, NaN);
        if (!(Number.isInteger(r) && r >= 0)) pridejT('počet řádků musí být celé nezáporné číslo');
        else if (r > MAX_RADKU_TABULKA) pridejT('nejvýše ' + MAX_RADKU_TABULKA.toLocaleString('cs-CZ') + ' řádků v jedné tabulce');
        else odhad = r;
      } else if (rezim === 'na_rodice') {
        const fk = sloupce.find(s => s.nazev === t.fkRodic);
        const a = naCislo(t.minNaRodice, 0), b = naCislo(t.maxNaRodice, 0);
        if (!fk || fk.typ !== 'reference') pridejT('pro „řádky na nadřazený řádek“ zvolte sloupec s cizím klíčem');
        else if (fk.tabulka === t.nazev) pridejT('„řádky na nadřazený řádek“ nelze vázat na odkaz na stejnou tabulku');
        else {
          if (fk.unikatni && b > 1) pridejT('cizí klíč „' + fk.nazev + '“ je unikátní, ale na jeden nadřazený řádek má připadat až ' + b + ' řádků');
        }
        if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a <= b)) pridejT('počet řádků na nadřazený řádek: celá čísla, 0 ≤ min ≤ max');
        else if (b > 10000) pridejT('nejvýše 10 000 řádků na jeden nadřazený řádek');
      } else pridejT('neznámý režim počtu řádků');
      odhadPevny.set(tn, rezim === 'pevny' ? odhad : null);

      // sloupce
      const pkSloupce = sloupce.filter(s => s.pk);
      if (pkSloupce.length > 1) pridejT('víc sloupců označených jako primární klíč – složený klíč není podporován; použijte unikátnost');
      const zavisiSl = new Map();
      const zavTab = [];
      for (const s of sloupce) {
        const sn = String(s.nazev || '').trim();
        const pridej = z => chyby.push({ tabulka: tn, sloupec: sn, zprava: z });
        const kontext = {
          sloupce: jmena, najdiTabulku, vPravidle: false,
          nadrazeny(fk, sl) {
            const f = sloupce.find(x => x.nazev === fk);
            if (!f) return 'nadrazeny(): sloupec „' + fk + '“ neexistuje';
            if (f.typ !== 'reference') return 'nadrazeny(): sloupec „' + fk + '“ není cizí klíč';
            const rt = najdiTabulku(f.tabulka);
            if (!rt) return null;
            if (!(rt.sloupce || []).some(x => x.nazev === sl)) return 'nadrazeny(): tabulka „' + rt.nazev + '“ nemá sloupec „' + sl + '“';
            if (rt === t) return 'nadrazeny(): odkaz na stejnou tabulku zatím není podporován';
            return null;
          },
        };
        const nullP = naCislo(s.nullP, 0);
        if (!(nullP >= 0 && nullP <= 100)) pridej('pravděpodobnost NULL musí být 0–100 %');
        if (s.pk && nullP > 0) pridej('primární klíč nesmí být NULL');
        overGenerator(s, kontext, pridej);
        const zav = [];
        try { zavislostiGeneratoru(s).forEach(x => zav.push(x)); } catch (e) { /* hlášeno výše */ }
        (Array.isArray(s.pravidla) ? s.pravidla : []).forEach((pr, pi) => {
          const pp = z => pridej('pravidlo ' + (pi + 1) + ': ' + z);
          try {
            const ast = parsujVyraz(pr.kdyz);
            zkontrolujVyraz(ast, kontext).forEach(z => pp('podmínka: ' + z));
            zavislostiVyrazu(ast).forEach(x => zav.push(x));
          } catch (e) { pp('podmínka: ' + e.message + (e.pozice !== undefined ? ' (znak ' + (e.pozice + 1) + ')' : '')); }
          const g = pr.gen || {};
          overGenerator(g, Object.assign({}, kontext, { vPravidle: true }), pp);
          try { zavislostiGeneratoru(g).forEach(x => zav.push(x)); } catch (e) { /* hlášeno */ }
        });
        if (zav.indexOf(sn) >= 0 && !(s.typ === 'reference')) pridej('sloupec závisí sám na sobě');
        zavisiSl.set(sn, zav.filter(x => x !== sn));
        if (s.typ === 'reference' && s.tabulka && s.tabulka !== t.nazev && najdiTabulku(s.tabulka)) zavTab.push(najdiTabulku(s.tabulka).nazev);
        // unikátnost: kapacita
        if ((s.unikatni || s.pk) && rezim === 'pevny' && !(Array.isArray(s.pravidla) && s.pravidla.length)) {
          const r = naCislo(t.radky, 0);
          const kap = kapacitaGeneratoru(s);
          const potreba = Math.ceil(r * (1 - nullP / 100));
          if (isFinite(kap) && kap < potreba && ['cele', 'desetinne', 'datum', 'datumcas', 'boolean', 'vycet', 'vzor', 'telefon', 'produkt', 'jmeno', 'adresa'].indexOf(s.typ) >= 0) {
            pridej('unikátnost nelze splnit: typ dává nejvýše ' + Math.max(0, kap).toLocaleString('cs-CZ') + ' různých hodnot, ale je potřeba ' + potreba.toLocaleString('cs-CZ') + ' – rozšiřte rozsah/vzor, snižte počet řádků nebo vypněte unikátnost');
          } else if (isFinite(kap) && kap < potreba * 1.5 && kap >= potreba) {
            varovani.push({ tabulka: tn, sloupec: sn, zprava: 'unikátní hodnoty zaplní ' + Math.round(100 * potreba / kap) + ' % možného rozsahu – generování může být pomalé' });
          }
        }
        if (s.typ === 'reference' && rezim === 'na_rodice' && s.nazev === t.fkRodic && nullP > 0) varovani.push({ tabulka: tn, sloupec: sn, zprava: 'NULL se u vazby „řádky na nadřazený řádek“ nepoužije' });
      }
      const tsl = topoRazeni(sloupce.map(s => s.nazev), zavisiSl);
      if (tsl.cyklus) pridejT('cyklická závislost sloupců: ' + tsl.cyklus.join(' → '));
      poradiSloupcu[tn] = tsl.poradi;
      zavisiTab.set(tn, zavTab);
    }
    const tt = topoRazeni(tabulky.map(t => String(t.nazev || '').trim()), zavisiTab);
    // odhad počtu řádků v pořadí podle cizích klíčů (u „na nadřazený řádek“ = rodič × průměr min–max)
    const odhady = new Map(); let celkem = 0;
    for (const n of tt.poradi) {
      const t = najdiTabulku(n); let o = odhadPevny.get(n);
      if (o === null || o === undefined) {
        const fk = (t.sloupce || []).find(s => s.nazev === t.fkRodic && s.typ === 'reference');
        const a = naCislo(t.minNaRodice, 0), b = naCislo(t.maxNaRodice, 0);
        o = fk && odhady.has(fk.tabulka) && isFinite(a + b) ? odhady.get(fk.tabulka) * (a + b) / 2 : 0;
      }
      odhady.set(n, o); celkem += o;
    }
    if (celkem > MAX_RADKU_CELKEM) chyby.push({ zprava: 'odhadem ' + Math.round(celkem).toLocaleString('cs-CZ') + ' řádků celkem – limit je ' + MAX_RADKU_CELKEM.toLocaleString('cs-CZ') });
    else if (celkem > 500000) varovani.push({ zprava: 'odhadem ' + Math.round(celkem).toLocaleString('cs-CZ') + ' řádků – generování i export zaberou víc paměti a času' });

    if (tt.cyklus) chyby.push({ zprava: 'cyklus cizích klíčů mezi tabulkami: ' + tt.cyklus.join(' → ') + ' – tabulky nelze naplnit v žádném pořadí; jeden z klíčů udělejte nepovinný a doplňte ho později (UPDATE), nebo vazbu zrušte' });
    return { chyby, varovani, poradi: tt.poradi, poradiSloupcu, odhadRadku: celkem, odhady };
  }

  /* ================= Generátor po dávkách ================= */
  function Generator(schema, volby) {
    volby = volby || {};
    this.schema = JSON.parse(JSON.stringify(schema));
    this.seed = volby.seed === undefined ? '1' : String(volby.seed);
    this.limit = volby.limitRadku === undefined ? Infinity : volby.limitRadku;
    this.limitPokusu = volby.limitPokusu || LIMIT_POKUSU;
    const k = zkontrolujSchema(this.schema);
    if (k.chyby.length) throw new ChybaSchematu(k.chyby);
    this.kontrola = k;
    this.data = {};
    this.poradi = k.poradi;
    this.ti = 0; this.st = null;
    this.mapyKlicu = new Map();
    this.hotovo = false;
  }

  Generator.prototype.tabulka = function (n) { return this.schema.tabulky.find(t => t.nazev === n); };

  Generator.prototype._mapaKlicu = function (tab, sl) {
    const k = tab + '\u001f' + sl;
    if (this.mapyKlicu.has(k)) return this.mapyKlicu.get(k);
    const d = this.data[tab]; const ix = d.sloupce.indexOf(sl); const m = new Map();
    for (let i = 0; i < d.radky.length; i++) m.set(d.radky[i][ix], i);
    this.mapyKlicu.set(k, m);
    return m;
  };

  Generator.prototype._zacniTabulku = function () {
    const tn = this.poradi[this.ti];
    const t = this.tabulka(tn);
    const self = this, seed = this.seed;
    const nazvy = t.sloupce.map(s => s.nazev);
    const indexSloupce = n => { const i = nazvy.indexOf(n); if (i < 0) throw new ChybaGenerovani('neznámý sloupec „' + n + '“'); return i; };
    const data = { sloupce: nazvy, radky: [] };
    this.data[tn] = data;

    // počet řádků a případné přiřazení k nadřazeným řádkům
    let N, prirazeni = null, fkRodicIx = -1, rodicData = null, rodicSlIx = -1;
    if ((t.rezimRadku || 'pevny') === 'na_rodice') {
      const fk = t.sloupce.find(s => s.nazev === t.fkRodic);
      rodicData = this.data[fk.tabulka]; rodicSlIx = rodicData.sloupce.indexOf(fk.sloupec);
      fkRodicIx = nazvy.indexOf(fk.nazev);
      const pp = vytvorProud(seed, tn, '#pocty');
      const a = naCislo(t.minNaRodice, 0), b = naCislo(t.maxNaRodice, 0);
      const pocty = []; let s = 0;
      for (let i = 0; i < rodicData.radky.length; i++) { const c = pp.cele(a, b); pocty.push(c); s += c; }
      if (s > MAX_RADKU_TABULKA) throw new ChybaGenerovani('tabulka „' + tn + '“ by měla ' + s.toLocaleString('cs-CZ') + ' řádků – limit je ' + MAX_RADKU_TABULKA.toLocaleString('cs-CZ'), { tabulka: tn });
      N = Math.min(s, this.limit);
      prirazeni = new Int32Array(N); let r = 0;
      for (let i = 0; i < pocty.length && r < N; i++) for (let c = 0; c < pocty[i] && r < N; c++) prirazeni[r++] = i;
    } else N = Math.min(naCislo(t.radky, 0), this.limit);

    const nadrazeny = (fkN, slN) => {
      const fkIx = indexSloupce(fkN); const fk = t.sloupce[fkIx];
      const rt = fk.tabulka; let mapa = null, rd = null, rix = -1;
      return ctx => {
        const v = ctx.hodnoty[fkIx]; if (v === null || v === undefined) return null;
        if (!mapa) { mapa = self._mapaKlicu(rt, fk.sloupec); rd = self.data[rt]; rix = rd.sloupce.indexOf(slN); }
        const i = mapa.get(v); if (i === undefined) return null;
        const h = rd.radky[i][rix]; return h === undefined ? null : h;
      };
    };
    const reference = (d, p, ucel) => {
      const vlastni = d.tabulka === tn;
      const rd = vlastni ? data : self.data[d.tabulka];
      const rix = rd.sloupce.indexOf(d.sloupec);
      if (vlastni) return ctx => ctx.index === 0 ? null : rd.radky[p.cele(0, ctx.index - 1)][rix];
      const n = rd.radky.length;
      if (n === 0) return () => null;
      if (d.unikatni || d.pk) {
        const dalsi = bezOpakovani(p, n, () => 'Sloupec „' + tn + '.' + d.nazev + '“ je unikátní cizí klíč, ale odkazovaná tabulka „' + d.tabulka + '“ má jen ' + n.toLocaleString('cs-CZ') + ' řádků – každý lze použít jen jednou.');
        return () => rd.radky[dalsi()][rix];
      }
      if (d.rozdeleni === 'zipf') {
        const s = naCislo(d.s, 1.1);
        const pp = vytvorProud(seed, tn, ucel, 'permutace');
        const perm = new Int32Array(n); for (let i = 0; i < n; i++) perm[i] = i;
        for (let i = n - 1; i > 0; i--) { const j = pp.cele(0, i); const x = perm[i]; perm[i] = perm[j]; perm[j] = x; }
        const kum = new Float64Array(n); let sum = 0;
        for (let i = 0; i < n; i++) { sum += 1 / Math.pow(i + 1, s); kum[i] = sum; }
        return () => {
          const x = p.r() * sum; let lo = 0, hi = n - 1;
          while (lo < hi) { const m = (lo + hi) >> 1; if (kum[m] > x) hi = m; else lo = m + 1; }
          return rd.radky[perm[lo]][rix];
        };
      }
      return () => rd.radky[p.cele(0, n - 1)][rix];
    };
    const kompilace = (def, ucel, unikatni) => kompilujGenerator(def, {
      proud: u => vytvorProud(seed, tn, ucel, u),
      indexSloupce, nadrazeny, unikatni: !!unikatni,
      popis: tn + '.' + (def.nazev || ucel),
      reference: (d, p) => reference(d, p, ucel),
    });

    const sloupce = t.sloupce.map((s, ix) => ({
      ix, nazev: s.nazev, def: s,
      nullP: naCislo(s.nullP, 0) / 100,
      unik: !!(s.unikatni || s.pk),
      mnozina: (s.unikatni || s.pk) ? new Set() : null,
      pNull: vytvorProud(seed, tn, s.nazev, 'null'),
      gen: kompilace(s, s.nazev, s.unikatni || s.pk),
      pravidla: (Array.isArray(s.pravidla) ? s.pravidla : []).map((pr, k) => ({
        kdyz: kompilujVyraz(parsujVyraz(pr.kdyz), { indexSloupce, proud: vytvorProud(seed, tn, s.nazev, 'podminka', k), nadrazeny }),
        gen: kompilace(Object.assign({}, VYCHOZI[(pr.gen || {}).typ] || {}, pr.gen || {}), s.nazev + '\u001fpravidlo' + k, false),
      })),
      fkRodic: ix === fkRodicIx,
    }));
    const poradi = this.kontrola.poradiSloupcu[tn].map(n => sloupce[nazvy.indexOf(n)]);
    this.st = { tn, N, i: 0, sloupce, poradi, data, prirazeni, rodicData, rodicSlIx, ctx: { hodnoty: null, index: 0 } };
  };

  Generator.prototype._radek = function () {
    const st = this.st; const ctx = st.ctx; const i = st.i;
    const h = new Array(st.sloupce.length);
    ctx.hodnoty = h; ctx.index = i;
    for (const c of st.poradi) {
      if (c.fkRodic) { h[c.ix] = st.rodicData.radky[st.prirazeni[i]][st.rodicSlIx]; continue; }
      const jeNull = c.pNull.r() < c.nullP;
      if (jeNull && c.unik) { h[c.ix] = null; continue; }
      let g = c.gen;
      for (const pr of c.pravidla) if (pravdive(pr.kdyz(ctx))) { g = pr.gen; break; }
      let v = g(ctx, 0);
      if (v === undefined) v = null;
      if (jeNull) { h[c.ix] = null; continue; }
      if (c.unik && v !== null) {
        let pokus = 0;
        while (c.mnozina.has(v)) {
          pokus++;
          if (pokus > this.limitPokusu) {
            throw new ChybaGenerovani('Sloupec „' + st.tn + '.' + c.nazev + '“: ani po ' + this.limitPokusu + ' pokusech se nepodařilo najít novou unikátní hodnotu (řádek ' + (i + 1).toLocaleString('cs-CZ') + ', už použito ' + c.mnozina.size.toLocaleString('cs-CZ') + ' hodnot). Rozsah hodnot je pro tento počet řádků zřejmě příliš malý – rozšiřte ho, snižte počet řádků nebo vypněte unikátnost.', { tabulka: st.tn, sloupec: c.nazev, radek: i });
          }
          v = g(ctx, pokus);
          if (v === undefined || v === null) { v = null; break; }
        }
        if (v !== null) c.mnozina.add(v);
      }
      h[c.ix] = v;
    }
    st.data.radky.push(h);
    st.i++;
  };

  /* Vygeneruje nejvýše maxRadku řádků. Vrací průběh. */
  Generator.prototype.krok = function (maxRadku) {
    let zbyva = Math.max(1, maxRadku || 1000);
    while (zbyva > 0 && !this.hotovo) {
      if (!this.st) {
        if (this.ti >= this.poradi.length) { this.hotovo = true; break; }
        this._zacniTabulku();
      }
      const st = this.st;
      const n = Math.min(zbyva, st.N - st.i);
      for (let k = 0; k < n; k++) this._radek();
      zbyva -= n;
      if (st.i >= st.N) {
        st.data.druhy = odvodDruhy(this.tabulka(st.tn), st.data, this.data, this.schema);
        this.st = null; this.ti++;
        if (this.ti >= this.poradi.length) this.hotovo = true;
      }
    }
    const st = this.st;
    return {
      hotovo: this.hotovo,
      tabulka: st ? st.tn : (this.poradi[this.ti - 1] || null),
      indexTabulky: Math.min(this.ti, this.poradi.length - 1),
      pocetTabulek: this.poradi.length,
      radek: st ? st.i : null,
      celkem: st ? st.N : null,
    };
  };

  Generator.prototype.vse = function () { while (!this.hotovo) this.krok(100000); return this.data; };

  /* Datový druh sloupce podle skutečných hodnot (pro SQL typy a formátování). */
  function odvodDruhy(t, d, vse) {
    return t.sloupce.map((s, ix) => {
      let cele = true, cisla = true, bool = true, dat = true, dc = true, uu = true, nic = true, max = 0;
      for (const r of d.radky) {
        const v = r[ix]; if (v === null || v === undefined) continue;
        nic = false;
        if (typeof v === 'number') { if (!Number.isInteger(v)) cele = false; if (Math.abs(v) > max) max = Math.abs(v); } else { cisla = false; cele = false; }
        if (typeof v !== 'boolean') bool = false;
        if (!jeDatumText(v)) dat = false;
        if (!jeDatumCasText(v)) dc = false;
        if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)) uu = false;
        if (!cisla && !bool && !dat && !dc && !uu) break;
      }
      if (nic) {
        const z = { sekvence: 'cele', cele: 'cele', desetinne: 'desetinne', datum: 'datum', datumcas: 'datumcas', boolean: 'boolean', uuid: 'uuid' }[s.typ];
        if (z) return { druh: z, velke: false };
        if (s.typ === 'reference' && vse[s.tabulka] && vse[s.tabulka].druhy) {
          const ri = vse[s.tabulka].sloupce.indexOf(s.sloupec); if (ri >= 0) return vse[s.tabulka].druhy[ri];
        }
        return { druh: 'text', velke: false };
      }
      if (cisla) return { druh: cele && s.typ !== 'desetinne' ? 'cele' : 'desetinne', velke: max > 2147483647, des: s.typ === 'desetinne' ? Math.round(naCislo(s.des, 2)) : undefined };
      if (bool) return { druh: 'boolean' };
      if (dat) return { druh: 'datum' };
      if (dc) return { druh: 'datumcas' };
      if (uu) return { druh: 'uuid' };
      return { druh: 'text' };
    });
  }

  /* ================= Statistiky ================= */
  function statistikyTabulky(d) {
    return d.sloupce.map((n, ix) => {
      const druh = d.druhy ? d.druhy[ix].druh : 'text';
      let nully = 0; const cetnost = new Map();
      let sum = 0, sum2 = 0, cnt = 0, min = null, max = null, dmin = Infinity, dmax = -Infinity, dsum = 0;
      const cisla = [];
      for (const r of d.radky) {
        const v = r[ix];
        if (v === null || v === undefined) { nully++; continue; }
        cetnost.set(v, (cetnost.get(v) || 0) + 1);
        if (typeof v === 'number') { sum += v; sum2 += v * v; cnt++; cisla.push(v); if (min === null || v < min) min = v; if (max === null || v > max) max = v; }
        else if (typeof v === 'string') {
          if (min === null || v < min) min = v; if (max === null || v > max) max = v;
          const l = v.length; if (l < dmin) dmin = l; if (l > dmax) dmax = l; dsum += l;
        }
      }
      const pocet = d.radky.length; const nn = pocet - nully;
      const o = { nazev: n, druh, pocet, nully, ruznych: cetnost.size };
      if (cnt) {
        const prumer = sum / cnt;
        o.min = min; o.max = max; o.prumer = prumer;
        o.smerOdch = cnt > 1 ? Math.sqrt(Math.max(0, (sum2 - cnt * prumer * prumer) / (cnt - 1))) : 0;
        cisla.sort((a, b) => a - b);
        o.median = cnt % 2 ? cisla[(cnt - 1) / 2] : (cisla[cnt / 2 - 1] + cisla[cnt / 2]) / 2;
      } else if (druh !== 'boolean' && nn) {
        o.min = min; o.max = max;
        if (druh === 'text' || druh === 'uuid') { o.delkaMin = dmin; o.delkaMax = dmax; o.delkaPrumer = dsum / nn; }
      }
      if (cetnost.size <= Math.max(50, nn * 0.5) || druh === 'boolean') {
        o.nejcastejsi = Array.from(cetnost.entries()).sort((a, b) => b[1] - a[1] || (String(a[0]) < String(b[0]) ? -1 : 1)).slice(0, 5);
      }
      return o;
    });
  }

  /* ================= Referenční integrita ================= */
  function kontrolaIntegrity(data, schema) {
    const polozky = [];
    for (const t of schema.tabulky) {
      const d = data[t.nazev]; if (!d) continue;
      t.sloupce.forEach((s, ix) => {
        if (s.pk || s.unikatni) {
          const m = new Set(); let dup = 0, nul = 0; const prik = [];
          for (const r of d.radky) {
            const v = r[ix];
            if (v === null || v === undefined) { nul++; continue; }
            if (m.has(v)) { dup++; if (prik.length < 3) prik.push(v); } else m.add(v);
          }
          polozky.push({ druh: s.pk ? 'pk' : 'unikatni', tabulka: t.nazev, sloupec: s.nazev, radku: d.radky.length, duplicit: dup, nullu: s.pk ? nul : 0, priklady: prik, ok: dup === 0 && (!s.pk || nul === 0) });
        }
        if (s.typ === 'reference') {
          const rd = data[s.tabulka];
          if (!rd) { polozky.push({ druh: 'fk', tabulka: t.nazev, sloupec: s.nazev, cil: s.tabulka + '.' + s.sloupec, ok: false, chyba: 'odkazovaná tabulka nebyla vygenerována' }); return; }
          const rix = rd.sloupce.indexOf(s.sloupec);
          const klice = new Set(); for (const r of rd.radky) if (r[rix] !== null) klice.add(r[rix]);
          let odkazu = 0, sirotku = 0, nul = 0; const prik = []; const pouzite = new Set();
          for (const r of d.radky) {
            const v = r[ix];
            if (v === null || v === undefined) { nul++; continue; }
            odkazu++; pouzite.add(v);
            if (!klice.has(v)) { sirotku++; if (prik.length < 3) prik.push(v); }
          }
          polozky.push({ druh: 'fk', tabulka: t.nazev, sloupec: s.nazev, cil: s.tabulka + '.' + s.sloupec, odkazu, nullu: nul, sirotku, priklady: prik, pokrytiRodicu: klice.size ? pouzite.size / klice.size : 0, ok: sirotku === 0 });
        }
      });
    }
    return { ok: polozky.every(p => p.ok), polozky };
  }

  /* ================= Exporty ================= */
  const POZNAMKA = 'SYNTETICKÁ TESTOVACÍ DATA – jména, adresy, e-maily (RFC 2606) a telefony (fiktivní rozsahy) jsou vymyšlené a nepatří skutečným osobám.';

  function csvPole(v, druh, m) {
    if (v === null || v === undefined) return '';
    let s;
    if (typeof v === 'boolean') s = v ? 'true' : 'false';
    else if (typeof v === 'number') { s = String(v); if (m.desetinnaCarka) s = s.replace('.', ','); }
    else {
      s = String(v);
      if (m.ochranaVzorcu && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    }
    const odd = m.oddelovac || ',';
    if (s.indexOf(odd) >= 0 || /["\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function jsonRadek(d, r) {
    let s = '{';
    for (let i = 0; i < d.sloupce.length; i++) {
      if (i) s += ',';
      const v = r[i];
      s += JSON.stringify(d.sloupce[i]) + ':' + (v === undefined ? 'null' : JSON.stringify(v));
    }
    return s + '}';
  }

  function sqlIdent(n) { return '"' + String(n).replace(/"/g, '""') + '"'; }
  function sqlLiteral(v, dialekt) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return dialekt === 'postgresql' ? (v ? 'TRUE' : 'FALSE') : (v ? '1' : '0');
    if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
    return "'" + String(v).replace(/\u0000/g, '').replace(/'/g, "''") + "'";
  }
  function sqlTyp(druh, s, dialekt) {
    if (s && s.sqlTyp && /^[A-Za-z][A-Za-z0-9_ ,()]*$/.test(String(s.sqlTyp).trim())) return String(s.sqlTyp).trim().toUpperCase();
    const d = druh.druh;
    if (dialekt === 'postgresql') {
      if (d === 'cele') return druh.velke ? 'BIGINT' : 'INTEGER';
      if (d === 'desetinne') return druh.des !== undefined ? 'NUMERIC(18,' + druh.des + ')' : 'DOUBLE PRECISION';
      if (d === 'boolean') return 'BOOLEAN';
      if (d === 'datum') return 'DATE';
      if (d === 'datumcas') return 'TIMESTAMP';
      if (d === 'uuid') return 'UUID';
      return 'TEXT';
    }
    if (d === 'cele' || d === 'boolean') return 'INTEGER';
    if (d === 'desetinne') return 'REAL';
    return 'TEXT';
  }

  /* Export jako iterátor kousků textu. moznosti: { format: csv|json|jsonl|sql, dialekt: sqlite|postgresql,
     tabulky: [názvy], oddelovac, desetinnaCarka, hlavicka, ochranaVzorcu, poznamka, createTable, dropTable,
     radkuNaInsert, transakce }. Iterátor vrací { text, hotovo, celkem }. */
  function* exportuj(data, schema, moznosti) {
    const m = Object.assign({ format: 'csv', dialekt: 'sqlite', hlavicka: true, oddelovac: ',', poznamka: true, createTable: true, dropTable: false, radkuNaInsert: 500, transakce: true, kousek: 2000 }, moznosti || {});
    const k = zkontrolujSchema(schema);
    const tabs = (m.tabulky && m.tabulky.length ? k.poradi.filter(n => m.tabulky.indexOf(n) >= 0) : k.poradi).filter(n => data[n]);
    const celkem = tabs.reduce((s, n) => s + data[n].radky.length, 0);
    let hotovo = 0;
    const KUS = Math.max(1, m.kousek);
    const def = n => schema.tabulky.find(t => t.nazev === n);

    if (m.format === 'csv') {
      if (tabs.length !== 1) throw new ChybaGenerovani('CSV obsahuje jen jednu tabulku – vyberte ji');
      const d = data[tabs[0]]; const druhy = d.druhy || d.sloupce.map(() => ({ druh: 'text' }));
      const odd = m.oddelovac; const NL = '\r\n';
      let s = m.bom ? '﻿' : '';
      if (m.hlavicka) s += d.sloupce.map(n => csvPole(n, 'text', Object.assign({}, m, { ochranaVzorcu: false }))).join(odd) + NL;
      for (let i = 0; i < d.radky.length; i++) {
        const r = d.radky[i];
        let line = '';
        for (let j = 0; j < r.length; j++) { if (j) line += odd; line += csvPole(r[j], druhy[j].druh, m); }
        s += line + NL; hotovo++;
        if ((i + 1) % KUS === 0) { yield { text: s, hotovo, celkem }; s = ''; }
      }
      yield { text: s, hotovo, celkem };
      return;
    }
    if (m.format === 'jsonl') {
      let s = '';
      for (const n of tabs) {
        const d = data[n]; const pref = tabs.length > 1 ? '{"_tabulka":' + JSON.stringify(n) + ',' : null;
        for (let i = 0; i < d.radky.length; i++) {
          const j = jsonRadek(d, d.radky[i]);
          s += (pref ? pref + j.slice(1) : j) + '\n'; hotovo++;
          if (hotovo % KUS === 0) { yield { text: s, hotovo, celkem }; s = ''; }
        }
      }
      yield { text: s, hotovo, celkem };
      return;
    }
    if (m.format === 'json') {
      let s = '{\n';
      let prvni = true;
      if (m.poznamka) { s += '  "_poznamka": ' + JSON.stringify(POZNAMKA); prvni = false; }
      for (const n of tabs) {
        const d = data[n];
        s += (prvni ? '' : ',\n') + '  ' + JSON.stringify(n) + ': [';
        prvni = false;
        for (let i = 0; i < d.radky.length; i++) {
          s += (i ? ',\n    ' : '\n    ') + jsonRadek(d, d.radky[i]); hotovo++;
          if (hotovo % KUS === 0) { yield { text: s, hotovo, celkem }; s = ''; }
        }
        s += d.radky.length ? '\n  ]' : ']';
      }
      s += '\n}\n';
      yield { text: s, hotovo, celkem };
      return;
    }
    if (m.format === 'sql') {
      const pg = m.dialekt === 'postgresql';
      const dial = pg ? 'postgresql' : 'sqlite';
      let s = '';
      if (m.poznamka) s += '-- ' + POZNAMKA + '\n-- Dialekt: ' + (pg ? 'PostgreSQL' : 'SQLite') + ', tabulek: ' + tabs.length + ', řádků: ' + celkem + '\n';
      if (pg) s += "SET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\n";
      else s += 'PRAGMA foreign_keys = ON;\n';
      if (m.transakce) s += 'BEGIN;\n';
      if (m.dropTable) for (const n of tabs.slice().reverse()) s += 'DROP TABLE IF EXISTS ' + sqlIdent(n) + (pg ? ' CASCADE' : '') + ';\n';
      if (m.createTable) {
        for (const n of tabs) {
          const t = def(n); const d = data[n];
          const radky = t.sloupce.map((sl, ix) => {
            let r = '  ' + sqlIdent(sl.nazev) + ' ' + sqlTyp(d.druhy[ix], sl, dial);
            if (sl.pk) r += ' PRIMARY KEY';
            else {
              const muzeNull = naCislo(sl.nullP, 0) > 0 || (sl.typ === 'reference' && sl.tabulka === n) || (Array.isArray(sl.pravidla) && sl.pravidla.length) || sl.typ === 'vzorec' || sl.typ === 'vycet';
              const maNull = d.radky.some(rr => rr[ix] === null);
              if (!muzeNull && !maNull) r += ' NOT NULL';
              if (sl.unikatni) r += ' UNIQUE';
            }
            if (sl.typ === 'reference' && tabs.indexOf(sl.tabulka) >= 0) r += ' REFERENCES ' + sqlIdent(sl.tabulka) + ' (' + sqlIdent(sl.sloupec) + ')';
            return r;
          });
          s += 'CREATE TABLE ' + (m.dropTable ? '' : 'IF NOT EXISTS ') + sqlIdent(n) + ' (\n' + radky.join(',\n') + '\n);\n';
        }
      }
      yield { text: s, hotovo, celkem }; s = '';
      const naIns = Math.max(1, Math.min(5000, m.radkuNaInsert || 500));
      for (const n of tabs) {
        const d = data[n];
        const hl = 'INSERT INTO ' + sqlIdent(n) + ' (' + d.sloupce.map(sqlIdent).join(', ') + ') VALUES\n';
        for (let i = 0; i < d.radky.length; i += naIns) {
          const konec = Math.min(d.radky.length, i + naIns);
          s += hl;
          for (let j = i; j < konec; j++) {
            const r = d.radky[j];
            let line = '  (';
            for (let c = 0; c < r.length; c++) { if (c) line += ', '; line += sqlLiteral(r[c], dial); }
            s += line + (j + 1 < konec ? '),\n' : ');\n');
          }
          hotovo += konec - i;
          if (s.length > 1 << 20) { yield { text: s, hotovo, celkem }; s = ''; }
        }
      }
      if (m.transakce) s += 'COMMIT;\n';
      yield { text: s, hotovo, celkem };
      return;
    }
    throw new ChybaGenerovani('neznámý formát exportu „' + m.format + '“');
  }

  function exportujText(data, schema, moznosti) {
    let s = ''; for (const k of exportuj(data, schema, moznosti)) s += k.text; return s;
  }

  /* ================= Šablony schémat ================= */
  function sl(nazev, typ, dalsi) { return Object.assign({ nazev, typ }, JSON.parse(JSON.stringify(VYCHOZI[typ] || {})), { nullP: 0, unikatni: false, pk: false, pravidla: [] }, dalsi || {}); }
  const SABLONY = {
    eshop: {
      nazev: 'E-shop: zákazníci → objednávky → položky',
      schema: () => ({
        tabulky: [
          { nazev: 'zakaznici', rezimRadku: 'pevny', radky: 1000, sloupce: [
            sl('id', 'sekvence', { pk: true }),
            sl('uuid', 'uuid', { unikatni: true }),
            sl('pohlavi', 'vycet', { hodnoty: 'M | 49\nŽ | 51' }),
            sl('jmeno', 'jmeno', { cast: 'krestni', pohlavi: 'sloupec', sloupecPohlavi: 'pohlavi' }),
            sl('prijmeni', 'jmeno', { cast: 'prijmeni', pohlavi: 'sloupec', sloupecPohlavi: 'pohlavi' }),
            sl('email', 'email', { zdroj: 'sloupce', sloupecJmeno: 'jmeno', sloupecPrijmeni: 'prijmeni', unikatni: true }),
            sl('telefon', 'telefon', { nullP: 20 }),
            sl('ulice', 'adresa', { cast: 'ulice' }),
            sl('obec', 'adresa', { cast: 'obec' }),
            sl('psc', 'adresa', { cast: 'psc' }),
            sl('registrace', 'datum', { od: '2021-01-01', do: '2025-06-30' }),
            sl('vip', 'boolean', { pravd: 8 }),
            sl('segment', 'vzorec', { vyraz: 'kdyz(vip, "VIP", kdyz(registrace < "2023-01-01", "stálý", "nový"))' }),
          ] },
          { nazev: 'produkty', rezimRadku: 'pevny', radky: 200, sloupce: [
            sl('id', 'sekvence', { pk: true }),
            sl('kod', 'vzor', { vzor: 'PRD-[A-HJ-NP-Z]{3}-####', unikatni: true }),
            sl('nazev', 'produkt'),
            sl('kategorie', 'vycet', { hodnoty: 'domácnost | 5\nzahrada | 3\nkancelář | 2\nsport | 2' }),
            sl('cena', 'desetinne', { min: 49, max: 9999, des: 2, rozdeleni: 'lognormalni', stred: 450, tvar: 0.8 }),
            sl('skladem', 'cele', { min: 0, max: 500, rozdeleni: 'exponencialni', stred: 60, nullP: 5 }),
          ] },
          { nazev: 'objednavky', rezimRadku: 'na_rodice', fkRodic: 'zakaznik_id', minNaRodice: 0, maxNaRodice: 8, sloupce: [
            sl('id', 'sekvence', { pk: true, start: 100001 }),
            sl('zakaznik_id', 'reference', { tabulka: 'zakaznici', sloupec: 'id' }),
            sl('datum', 'vzorec', { vyraz: 'datum_plus(nadrazeny(zakaznik_id, "registrace"), nahodne(0, 365))' }),
            sl('stav', 'vycet', { hodnoty: 'nová | 8\nzaplacená | 12\nodeslaná | 20\ndoručená | 55\nzrušená | 5' }),
            sl('doprava', 'vycet', { hodnoty: 'kurýr | 5\nvýdejní místo | 7\nosobní odběr | 2' }),
            sl('zaplaceno', 'vzorec', { vyraz: 'stav == "nová" || stav == "zrušená" ? null : datum_plus(datum, nahodne(0, 3))' }),
            sl('poznamka', 'text', { rezim: 'vety', min: 1, max: 2, nullP: 85, pravidla: [
              { kdyz: 'stav == "zrušená"', gen: { typ: 'vycet', hodnoty: 'Zrušeno zákazníkem | 3\nZboží není skladem | 1\nNeuhrazeno v termínu | 2' } },
            ] }),
          ] },
          { nazev: 'polozky', rezimRadku: 'na_rodice', fkRodic: 'objednavka_id', minNaRodice: 1, maxNaRodice: 5, sloupce: [
            sl('id', 'sekvence', { pk: true }),
            sl('objednavka_id', 'reference', { tabulka: 'objednavky', sloupec: 'id' }),
            sl('produkt_id', 'reference', { tabulka: 'produkty', sloupec: 'id', rozdeleni: 'zipf', s: 1.1 }),
            sl('mnozstvi', 'cele', { min: 1, max: 10, rozdeleni: 'exponencialni', stred: 1.6 }),
            sl('cena_ks', 'vzorec', { vyraz: 'nadrazeny(produkt_id, "cena")' }),
            sl('celkem', 'vzorec', { vyraz: 'zaokrouhli(mnozstvi * cena_ks, 2)' }),
          ] },
        ],
      }),
    },
    zamestnanci: {
      nazev: 'Firma: oddělení a zaměstnanci (s nadřízenými)',
      schema: () => ({
        tabulky: [
          { nazev: 'oddeleni', rezimRadku: 'pevny', radky: 6, sloupce: [
            sl('id', 'sekvence', { pk: true }),
            sl('nazev', 'vycet', { hodnoty: 'Vývoj\nObchod\nÚčetnictví\nLogistika\nPersonální\nPodpora', unikatni: true }),
            sl('kod', 'vzor', { vzor: 'OD-##', unikatni: true }),
          ] },
          { nazev: 'zamestnanci', rezimRadku: 'pevny', radky: 300, sloupce: [
            sl('id', 'sekvence', { pk: true }),
            sl('osobni_cislo', 'vzor', { vzor: 'Z-#####', unikatni: true }),
            sl('pohlavi', 'vycet', { hodnoty: 'M\nŽ' }),
            sl('jmeno', 'jmeno', { cast: 'cele', pohlavi: 'sloupec', sloupecPohlavi: 'pohlavi' }),
            sl('email', 'email', { zdroj: 'nahodny', domena: 'example.org', unikatni: true }),
            sl('oddeleni_id', 'reference', { tabulka: 'oddeleni', sloupec: 'id', rozdeleni: 'zipf', s: 0.8 }),
            sl('nadrizeny_id', 'reference', { tabulka: 'zamestnanci', sloupec: 'id', nullP: 3 }),
            sl('nastup', 'datum', { od: '2008-01-01', do: '2025-09-30', rozdeleni: 'trojuhelnikove', stred: '2025-09-30' }),
            sl('uvazek', 'vycet', { hodnoty: '1.0 | 8\n0.8 | 1\n0.5 | 1' }),
            sl('plat', 'cele', { min: 28000, max: 180000, rozdeleni: 'lognormalni', stred: 52000, tvar: 0.35 }),
            sl('aktivni', 'boolean', { pravd: 92 }),
            sl('odchod', 'vzorec', { vyraz: 'datum_plus(nastup, nahodne(30, max(30, rozdil_dni("2025-12-31", nastup))))', pravidla: [{ kdyz: 'aktivni', gen: { typ: 'null' } }] }),
          ] },
        ],
      }),
    },
    prazdne: {
      nazev: 'Prázdná tabulka',
      schema: () => ({ tabulky: [{ nazev: 'tabulka1', rezimRadku: 'pevny', radky: 100, sloupce: [sl('id', 'sekvence', { pk: true }), sl('hodnota', 'cele')] }] }),
    },
  };

  const API = {
    cyrb128, sfc32u, vytvorProud,
    bezDiakritiky, slug, zaokrouhli, dnyZData, dataZDnu, sekZDatumCasu, datumCasZSek,
    tokenizuj, parsujVyraz, zavislostiVyrazu, zkontrolujVyraz, kompilujVyraz, FUNKCE, pravdive,
    kompilujVzor, parsujVycet, vzorekRozdeleni, kompilujGenerator, uuid4,
    TYPY, VYCHOZI, novySloupec: sl, SABLONY, kapacitaGeneratoru,
    topoRazeni, zkontrolujSchema, popisChyby, Generator,
    ChybaVyrazu, ChybaGenerovani, ChybaSchematu,
    statistikyTabulky, kontrolaIntegrity, odvodDruhy,
    csvPole, sqlLiteral, sqlIdent, sqlTyp, exportuj, exportujText, POZNAMKA,
    MAX_RADKU_TABULKA, MAX_RADKU_CELKEM, LIMIT_POKUSU,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else koren.TDJadro = API;
})(typeof self !== 'undefined' ? self : this);
