/* ============================================================
   SQLite prohlížeč – výpočetní jádro bez DOM.
   Čisté funkce: tokenizér SQL, filtry a řazení výsledků, stavba
   parametrizovaných dotazů, CSV/JSON/SQL export, rozbor hlavičky
   a B-stromů souboru SQLite (velikosti objektů bez dbstat),
   model a rozložení ER diagramu, příprava dat pro graf.
   Testuje se v node (_test/sqlite_test.js).
   ============================================================ */
(function () {
  'use strict';

  // ---------- identifikátory a literály ----------
  function q(id) { return '"' + String(id).replace(/"/g, '""') + '"'; }

  function hexRetezec(u8, max) {
    const n = max == null ? u8.length : Math.min(max, u8.length);
    let s = '';
    for (let i = 0; i < n; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16);
    return s.toUpperCase();
  }

  /** Literál SQL pro výpis (dump). */
  function lit(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'number') {
      if (Number.isNaN(v)) return 'NULL';
      if (v === Infinity) return '9e999';
      if (v === -Infinity) return '-9e999';
      // celé číslo uložené jako REAL musí zůstat REAL
      return Number.isInteger(v) && !Object.is(v, -0) ? String(v) : (Number.isInteger(v) ? v.toFixed(1) : String(v));
    }
    if (v instanceof Uint8Array) return "X'" + hexRetezec(v) + "'";
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  /** Typ hodnoty v pojmech SQLite. */
  function typHodnoty(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'bigint') return 'integer';
    if (typeof v === 'number') return Number.isInteger(v) && !Object.is(v, -0) ? 'integer' : 'real';
    if (v instanceof Uint8Array) return 'blob';
    return 'text';
  }

  /** BigInt v bezpečném rozsahu převede na Number (sql.js s useBigInt vrací všechna celá čísla jako BigInt). */
  const MAXS = BigInt(Number.MAX_SAFE_INTEGER), MINS = BigInt(Number.MIN_SAFE_INTEGER);
  function normalizujRadek(r) {
    for (let i = 0; i < r.length; i++) {
      const v = r[i];
      if (typeof v === 'bigint' && v <= MAXS && v >= MINS) r[i] = Number(v);
    }
    return r;
  }

  // ---------- řazení podle pravidel SQLite ----------
  const TRIDA = { null: 0, integer: 1, real: 1, text: 2, blob: 3 };
  function porovnejBloby(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  }
  /** NULL < čísla < text < BLOB (jako ORDER BY v SQLite). kolace: 'binary' | 'nocase' | Intl.Collator */
  function porovnej(a, b, kolace) {
    const ta = TRIDA[typHodnoty(a)], tb = TRIDA[typHodnoty(b)];
    if (ta !== tb) return ta - tb;
    if (ta === 0) return 0;
    if (ta === 1) return a < b ? -1 : a > b ? 1 : 0;
    if (ta === 3) return porovnejBloby(a, b);
    if (kolace && typeof kolace === 'object' && kolace.compare) return kolace.compare(a, b);
    if (kolace === 'nocase') { a = a.toLowerCase(); b = b.toLowerCase(); }
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /** Stabilně seřadí pole indexů řádků podle [{sloupec:i, smer:'asc'|'desc'}]. */
  function seradIndexy(radky, indexy, razeni, kolace) {
    if (!razeni || !razeni.length) return indexy;
    const pary = indexy.map((ix, poradi) => [ix, poradi]);
    pary.sort((A, B) => {
      for (const r of razeni) {
        const c = porovnej(radky[A[0]][r.sloupec], radky[B[0]][r.sloupec], kolace);
        if (c) return r.smer === 'desc' ? -c : c;
      }
      return A[1] - B[1];
    });
    return pary.map(p => p[0]);
  }

  // ---------- filtry ----------
  /** Rozebere text filtru: '' | NULL | !NULL | =x | !=x | <>x | >x | >=x | <x | <=x | jinak „obsahuje". */
  function rozeberFiltr(text) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return null;
    const S = s.toUpperCase();
    if (S === 'NULL' || S === 'IS NULL' || S === '∅') return { op: 'null' };
    if (S === '!NULL' || S === 'NOT NULL' || S === 'IS NOT NULL') return { op: 'notnull' };
    const m = /^(<=|>=|<>|!=|=|<|>)\s*(.*)$/.exec(s);
    if (m) {
      const op = m[1] === '<>' ? '!=' : m[1];
      let h = m[2];
      if (/^'.*'$/.test(h) || /^".*"$/.test(h)) h = h.slice(1, -1);
      else if (h !== '' && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(h.replace(',', '.'))) h = Number(h.replace(',', '.'));
      return { op, hodnota: h };
    }
    return { op: 'obsahuje', hodnota: s };
  }

  function naText(v) {
    if (v === null || v === undefined) return null;
    if (v instanceof Uint8Array) return hexRetezec(v);
    if (typeof v === 'number') return String(v);
    return String(v);
  }

  /** Splňuje hodnota filtr? Sémantika odpovídá filtrNaSql (porovnání čísel numericky, text bez ohledu na velikost písmen u „obsahuje"). */
  function splnujeFiltr(v, f) {
    if (!f) return true;
    if (f.op === 'null') return v === null || v === undefined;
    if (f.op === 'notnull') return !(v === null || v === undefined);
    if (v === null || v === undefined) return false;
    if (f.op === 'obsahuje') {
      const t = naText(v);
      return t.toLowerCase().includes(String(f.hodnota).toLowerCase());
    }
    // bez převodu typů – stejně jako SQLite u hodnot bez afinity (číslo < text < BLOB)
    const c = porovnej(v, f.hodnota);
    switch (f.op) {
      case '=': return c === 0;
      case '!=': return c !== 0;
      case '<': return c < 0;
      case '<=': return c <= 0;
      case '>': return c > 0;
      case '>=': return c >= 0;
    }
    return true;
  }

  /** Escapování pro LIKE ... ESCAPE '\'. */
  function escLike(s) { return String(s).replace(/[\\%_]/g, m => '\\' + m); }

  /** Filtr → fragment WHERE a parametry (vždy parametrizovaně). */
  function filtrNaSql(sloupec, f) {
    const c = q(sloupec);
    if (!f) return null;
    switch (f.op) {
      case 'null': return { sql: c + ' IS NULL', params: [] };
      case 'notnull': return { sql: c + ' IS NOT NULL', params: [] };
      case 'obsahuje': return { sql: 'CAST(' + c + " AS TEXT) LIKE ? ESCAPE '\\'", params: ['%' + escLike(f.hodnota) + '%'] };
      default: {
        const op = f.op === '!=' ? '<>' : f.op;
        return { sql: c + ' ' + op + ' ?', params: [f.hodnota] };
      }
    }
  }

  /** Filtruje řádky v paměti (výsledek SQL dotazu). filtry: {indexSloupce: text}, hledat: text ve kterémkoli sloupci. */
  function filtrujIndexy(radky, filtry, hledat) {
    const fs = [];
    for (const k in (filtry || {})) { const f = rozeberFiltr(filtry[k]); if (f) fs.push([Number(k), f]); }
    const h = hledat ? String(hledat).toLowerCase() : '';
    const out = [];
    for (let i = 0; i < radky.length; i++) {
      const r = radky[i];
      let ok = true;
      for (const [ix, f] of fs) if (!splnujeFiltr(r[ix], f)) { ok = false; break; }
      if (ok && h) {
        ok = false;
        for (const v of r) { const t = naText(v); if (t !== null && t.toLowerCase().includes(h)) { ok = true; break; } }
      }
      if (ok) out.push(i);
    }
    return out;
  }

  /** Alias rowid, který není zastíněn sloupcem stejného jména. */
  function vyberRowidAlias(nazvySloupcu) {
    const m = new Set(nazvySloupcu.map(s => String(s).toLowerCase()));
    for (const a of ['rowid', '_rowid_', 'oid']) if (!m.has(a)) return a;
    return null;
  }

  /** Dotaz pro prohlížení tabulky se stránkováním, filtry a řazením. klic: {typ:'rowid', alias} | {typ:'pk', sloupce:[..]} | {typ:'zadny'} */
  function sestavDotazProhlizeni(o) {
    const sloupce = o.sloupce;
    const where = [], params = [];
    for (const k in (o.filtry || {})) {
      const f = rozeberFiltr(o.filtry[k]);
      const jm = sloupce[Number(k)];
      if (!f || jm === undefined) continue;
      const w = filtrNaSql(jm, f); where.push(w.sql); params.push(...w.params);
    }
    if (o.hledat && String(o.hledat).trim()) {
      const p = '%' + escLike(String(o.hledat).trim()) + '%';
      where.push('(' + sloupce.map(s => 'CAST(' + q(s) + " AS TEXT) LIKE ? ESCAPE '\\'").join(' OR ') + ')');
      for (let i = 0; i < sloupce.length; i++) params.push(p);
    }
    const W = where.length ? ' WHERE ' + where.join(' AND ') : '';
    let klicSql = '';
    if (o.klic && o.klic.typ === 'rowid') klicSql = o.klic.alias + ' AS "__klic0", ';
    else if (o.klic && o.klic.typ === 'pk') klicSql = o.klic.sloupce.map((s, i) => q(s) + ' AS "__klic' + i + '", ').join('');
    const vyber = sloupce.map(q).join(', ');
    const zdroj = (o.schema ? q(o.schema) + '.' : '') + q(o.tabulka);
    let ord = '';
    if (o.razeni && o.razeni.length) ord = ' ORDER BY ' + o.razeni.map(r => q(sloupce[r.sloupec]) + (r.smer === 'desc' ? ' DESC' : ' ASC')).join(', ');
    else if (o.klic && o.klic.typ === 'rowid') ord = ' ORDER BY ' + o.klic.alias;
    const limit = Math.max(1, Math.min(100000, o.limit | 0 || 100));
    const offset = Math.max(0, o.offset | 0);
    return {
      sql: 'SELECT ' + klicSql + vyber + ' FROM ' + zdroj + W + ord + ' LIMIT ' + limit + ' OFFSET ' + offset,
      params,
      sqlPocet: 'SELECT count(*) FROM ' + zdroj + W,
      paramsPocet: params.slice(),
      pocetKlicu: o.klic ? (o.klic.typ === 'rowid' ? 1 : o.klic.typ === 'pk' ? o.klic.sloupce.length : 0) : 0
    };
  }

  /** WHERE pro jeden řádek podle klíče. */
  function whereKlic(klic, hodnoty) {
    if (klic.typ === 'rowid') return { sql: klic.alias + ' = ?', params: [hodnoty[0]] };
    if (klic.typ === 'pk') return { sql: klic.sloupce.map(s => q(s) + ' IS ?').join(' AND '), params: hodnoty.slice() };
    throw new Error('Řádek nelze jednoznačně určit (tabulka nemá rowid ani PRIMARY KEY).');
  }

  // ---------- CSV a JSON ----------
  function csvPole(v, odd, moz) {
    if (v === null || v === undefined) return moz && moz.nullJako != null ? moz.nullJako : '';
    let s;
    if (v instanceof Uint8Array) s = hexRetezec(v);
    else if (typeof v === 'number' && moz && moz.desetinnaCarka) s = String(v).replace('.', ',');
    else s = String(v);
    if (moz && moz.ochranaVzorcu && typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (s.includes(odd) || s.includes('"') || s.includes('\n') || s.includes('\r') || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  /** CSV podle RFC 4180 (CRLF, uvozovky zdvojené). Vrací pole kusů (kvůli velkým exportům). */
  function naCsvKusy(sloupce, radky, moz) {
    moz = moz || {};
    const odd = moz.oddelovac || ',', eol = moz.konecRadku || '\r\n';
    const kusy = [];
    let buf = (moz.bom ? '﻿' : '');
    if (moz.hlavicka !== false) buf += sloupce.map(s => csvPole(s, odd, null)).join(odd) + eol;
    for (const r of radky) {
      let radek = '';
      for (let i = 0; i < r.length; i++) radek += (i ? odd : '') + csvPole(r[i], odd, moz);
      buf += radek + eol;
      if (buf.length > 1 << 20) { kusy.push(buf); buf = ''; }
    }
    if (buf) kusy.push(buf);
    return kusy;
  }
  function naCsv(sloupce, radky, moz) { return naCsvKusy(sloupce, radky, moz).join(''); }

  function jsonHodnota(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'bigint') return v.toString(); // JSON číslo libovolné délky
    if (typeof v === 'number') return Number.isFinite(v) ? JSON.stringify(v) : 'null';
    if (v instanceof Uint8Array) return JSON.stringify({ $blob_hex: hexRetezec(v) });
    return JSON.stringify(v);
  }
  function jsonKlice(sloupce) {
    const pouzite = new Map();
    return sloupce.map(s => {
      let n = (pouzite.get(s) || 0) + 1; pouzite.set(s, n);
      let k = n > 1 ? s + '_' + n : s;
      while (n > 1 && pouzite.has(k)) k = s + '_' + (++n);
      if (n > 1) pouzite.set(k, 1);
      return JSON.stringify(k);
    });
  }
  function jsonObjekt(klice, r) { return '{' + r.map((v, j) => klice[j] + ':' + jsonHodnota(v)).join(',') + '}'; }
  /** JSON: pole objektů (výchozí) nebo {columns, rows}. Duplicitní názvy sloupců dostanou příponu _2, _3… */
  function naJsonKusy(sloupce, radky, moz) {
    moz = moz || {};
    const kusy = [];
    if (moz.tvar === 'pole') {
      let buf = '{"columns":' + JSON.stringify(sloupce) + ',"rows":[';
      radky.forEach((r, i) => {
        buf += (i ? ',' : '') + '\n[' + r.map(jsonHodnota).join(',') + ']';
        if (buf.length > 1 << 20) { kusy.push(buf); buf = ''; }
      });
      kusy.push(buf + '\n]}\n');
      return kusy;
    }
    const klice = jsonKlice(sloupce);
    let buf = '[';
    radky.forEach((r, i) => {
      buf += (i ? ',' : '') + '\n' + jsonObjekt(klice, r);
      if (buf.length > 1 << 20) { kusy.push(buf); buf = ''; }
    });
    kusy.push(buf + (radky.length ? '\n' : '') + ']\n');
    return kusy;
  }
  function naJson(sloupce, radky, moz) { return naJsonKusy(sloupce, radky, moz).join(''); }

  // ---------- tokenizér SQL (zvýrazňování, dělení příkazů) ----------
  const KLICOVA = new Set(('ABORT ACTION ADD AFTER ALL ALTER ALWAYS ANALYZE AND AS ASC ATTACH AUTOINCREMENT BEFORE BEGIN BETWEEN BY ' +
    'CASCADE CASE CAST CHECK COLLATE COLUMN COMMIT CONFLICT CONSTRAINT CREATE CROSS CURRENT CURRENT_DATE CURRENT_TIME ' +
    'CURRENT_TIMESTAMP DATABASE DEFAULT DEFERRABLE DEFERRED DELETE DESC DETACH DISTINCT DO DROP EACH ELSE END ESCAPE ' +
    'EXCEPT EXCLUDE EXCLUSIVE EXISTS EXPLAIN FAIL FILTER FIRST FOLLOWING FOR FOREIGN FROM FULL GENERATED GLOB GROUP GROUPS ' +
    'HAVING IF IGNORE IMMEDIATE IN INDEX INDEXED INITIALLY INNER INSERT INSTEAD INTERSECT INTO IS ISNULL JOIN KEY LAST LEFT ' +
    'LIKE LIMIT MATCH MATERIALIZED NATURAL NO NOT NOTHING NOTNULL NULL NULLS OF OFFSET ON OR ORDER OTHERS OUTER OVER PARTITION ' +
    'PLAN PRAGMA PRECEDING PRIMARY QUERY RAISE RANGE RECURSIVE REFERENCES REGEXP REINDEX RELEASE RENAME REPLACE RESTRICT ' +
    'RETURNING RIGHT ROLLBACK ROW ROWS SAVEPOINT SELECT SET STRICT TABLE TEMP TEMPORARY THEN TIES TO TRANSACTION TRIGGER ' +
    'UNBOUNDED UNION UNIQUE UPDATE USING VACUUM VALUES VIEW VIRTUAL WHEN WHERE WINDOW WITH WITHOUT ROWID ' +
    'INTEGER TEXT REAL BLOB NUMERIC ANY TRUE FALSE').split(' '));
  const FUNKCE = new Set(('abs avg changes char coalesce concat concat_ws count date datetime format glob group_concat hex ifnull iif instr ' +
    'json json_array json_extract json_group_array json_group_object json_object json_each json_tree julianday last_insert_rowid length like ' +
    'likelihood lower ltrim max min nullif octet_length printf quote random randomblob replace round rtrim sign soundex sqlite_version ' +
    'strftime string_agg substr substring sum time timediff total total_changes trim typeof unhex unicode unixepoch upper zeroblob ' +
    'row_number rank dense_rank percent_rank cume_dist ntile lag lead first_value last_value nth_value').split(' '));

  /** Rozdělí SQL na tokeny {t, s, z} (t: kw, fn, id, str, num, kom, op, par, ws, blob, chyba). Spojení s === vstup. */
  function tokenizuj(sql) {
    const out = [];
    const n = sql.length;
    let i = 0;
    const push = (t, z, k) => out.push({ t, s: sql.slice(z, k), z });
    while (i < n) {
      const c = sql[i], z = i;
      if (/\s/.test(c)) { while (i < n && /\s/.test(sql[i])) i++; push('ws', z, i); continue; }
      if (c === '-' && sql[i + 1] === '-') { while (i < n && sql[i] !== '\n') i++; push('kom', z, i); continue; }
      if (c === '/' && sql[i + 1] === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; push('kom', z, i); continue; }
      if ((c === 'x' || c === 'X') && sql[i + 1] === "'") {
        i += 2; while (i < n && sql[i] !== "'") i++; i = Math.min(n, i + 1); push('blob', z, i); continue;
      }
      if (c === "'") {
        i++;
        while (i < n) { if (sql[i] === "'") { if (sql[i + 1] === "'") { i += 2; continue; } i++; break; } i++; }
        push('str', z, i); continue;
      }
      if (c === '"' || c === '`') {
        i++;
        while (i < n) { if (sql[i] === c) { if (sql[i + 1] === c) { i += 2; continue; } i++; break; } i++; }
        push('id', z, i); continue;
      }
      if (c === '[') { const e = sql.indexOf(']', i); i = e < 0 ? n : e + 1; push('id', z, i); continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        if (c === '0' && /[xX]/.test(sql[i + 1] || '')) { i += 2; while (i < n && /[0-9a-fA-F_]/.test(sql[i])) i++; }
        else {
          while (i < n && /[0-9_]/.test(sql[i])) i++;
          if (sql[i] === '.') { i++; while (i < n && /[0-9_]/.test(sql[i])) i++; }
          if (/[eE]/.test(sql[i] || '') && /[0-9+-]/.test(sql[i + 1] || '')) { i += 2; while (i < n && /[0-9]/.test(sql[i])) i++; }
        }
        push('num', z, i); continue;
      }
      if (c === '?') { i++; while (i < n && /[0-9]/.test(sql[i])) i++; push('par', z, i); continue; }
      if ((c === ':' || c === '@' || c === '$') && /[A-Za-z_À-￿]/.test(sql[i + 1] || '')) {
        i++; while (i < n && /[\wÀ-￿$]/.test(sql[i])) i++; push('par', z, i); continue;
      }
      if (/[A-Za-z_À-￿]/.test(c)) {
        while (i < n && /[\wÀ-￿$]/.test(sql[i])) i++;
        const w = sql.slice(z, i);
        let j = i; while (j < n && /\s/.test(sql[j])) j++;
        if (sql[j] === '(' && FUNKCE.has(w.toLowerCase())) push('fn', z, i);
        else push(KLICOVA.has(w.toUpperCase()) ? 'kw' : 'id', z, i);
        continue;
      }
      const dva = sql.substr(i, 2);
      if (['<=', '>=', '<>', '!=', '==', '||', '<<', '>>', '->'].includes(dva)) { i += (sql.substr(i, 3) === '->>' ? 3 : 2); push('op', z, i); continue; }
      i++; push('op', z, i);
    }
    return out;
  }

  /** Rozdělí skript na příkazy s ohledem na řetězce, komentáře a těla triggerů (BEGIN … END). Vrací [{sql, z, k}]. */
  function rozdelPrikazy(sql) {
    const tok = tokenizuj(sql);
    const out = [];
    let start = 0, vTriggeru = false, hloubka = 0, prvni = [];
    for (const t of tok) {
      if (t.t === 'kw') {
        const w = t.s.toUpperCase();
        if (prvni.length < 4) prvni.push(w);
        if (prvni[0] === 'CREATE' && w === 'TRIGGER') vTriggeru = true;
        if (vTriggeru) {
          if (w === 'BEGIN' || w === 'CASE') hloubka++;
          else if (w === 'END') hloubka--;
        }
      }
      if (t.t === 'op' && t.s === ';' && !(vTriggeru && hloubka > 0)) {
        const k = t.z + 1;
        if (sql.slice(start, t.z).trim()) out.push({ sql: sql.slice(start, k), z: start, k });
        start = k; vTriggeru = false; hloubka = 0; prvni = [];
      }
    }
    if (sql.slice(start).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '').trim()) out.push({ sql: sql.slice(start), z: start, k: sql.length });
    return out.map(p => {
      // zbavit se úvodních bílých znaků a komentářů v rozsahu
      const lead = /^(\s|--[^\n]*\n?|\/\*[\s\S]*?\*\/)*/.exec(p.sql)[0].length;
      return { sql: p.sql.slice(lead).replace(/;\s*$/, '').trim(), z: p.z + lead, k: p.k };
    }).filter(p => p.sql && !/^(\s|--[^\n]*|\/\*[\s\S]*?\*\/)*$/.test(p.sql));
  }

  /** Příkaz, ve kterém (nebo těsně za kterým) leží kurzor. */
  function prikazNaPozici(sql, pos) {
    const p = rozdelPrikazy(sql);
    if (!p.length) return null;
    for (const x of p) if (pos >= x.z && pos <= x.k) return x;
    let nej = p[0];
    for (const x of p) if (x.z <= pos) nej = x;
    return nej;
  }

  /** První klíčové slovo příkazu (přeskočí komentáře, závorky). */
  function prvniSlovo(sql) {
    for (const t of tokenizuj(sql)) {
      if (t.t === 'ws' || t.t === 'kom' || (t.t === 'op' && t.s === '(')) continue;
      return t.s.toUpperCase();
    }
    return '';
  }
  /** Obsahuje skript řízení transakcí (pak se nebalí do automatické transakce)? */
  function ridiTransakce(sql) {
    return rozdelPrikazy(sql).some(p => {
      const w = prvniSlovo(p.sql);
      if (['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'VACUUM', 'ATTACH', 'DETACH'].includes(w)) return true;
      if (w === 'PRAGMA' && /\bjournal_mode\b|\bforeign_keys\b/i.test(p.sql)) return true;
      return false;
    });
  }

  // ---------- EXPLAIN QUERY PLAN ----------
  /** Řádky [id, parent, notused, detail] → strom; přidá varování. */
  function stromPlanu(radky) {
    const uzly = new Map(), koreny = [];
    for (const r of radky) uzly.set(Number(r[0]), { id: Number(r[0]), rodic: Number(r[1]), detail: String(r[3]), deti: [], varovani: null });
    for (const u of uzly.values()) {
      const d = u.detail;
      if (/^SCAN\b/.test(d) && !/\bUSING\b.*\bINDEX\b/.test(d) && !/^SCAN CONSTANT ROW/.test(d) && !/VIRTUAL TABLE/.test(d)) u.varovani = 'Úplný průchod tabulkou – u velkých tabulek pomalé; zvažte index na filtrovaných sloupcích.';
      else if (/USE TEMP B-TREE/.test(d)) u.varovani = 'Dočasný B-strom (řazení/seskupení bez indexu).';
      else if (/AUTOMATIC/.test(d)) u.varovani = 'SQLite si vytváří dočasný automatický index – trvalý index by dotaz zrychlil.';
      const rod = uzly.get(u.rodic);
      if (rod && rod !== u) rod.deti.push(u); else koreny.push(u);
    }
    return koreny;
  }

  // ---------- hlavička a B-stromy souboru ----------
  const MAGIE = 'SQLite format 3\u0000';
  function u16(b, o) { return (b[o] << 8) | b[o + 1]; }
  function u32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }

  function ctiHlavicku(b) {
    if (!b || b.length < 100) return { platne: false, chyba: 'Soubor je kratší než hlavička SQLite (100 B).' };
    let m = ''; for (let i = 0; i < 16; i++) m += String.fromCharCode(b[i]);
    if (m !== MAGIE) return { platne: false, chyba: 'Soubor nezačíná podpisem „SQLite format 3" – nejde o databázi SQLite 3 (nebo je šifrovaná).' };
    let ps = u16(b, 16); if (ps === 1) ps = 65536;
    const zmeny = u32(b, 24), validFor = u32(b, 92);
    const v = u32(b, 96);
    const h = {
      platne: true,
      velikostStranky: ps,
      verzeZapisu: b[18], verzeCteni: b[19],
      rezerva: b[20],
      citacZmen: zmeny,
      pocetStranekHlavicka: u32(b, 28),
      pocetStranekPlatny: zmeny === validFor && u32(b, 28) > 0,
      prvniFreelist: u32(b, 32),
      pocetFreelist: u32(b, 36),
      schemaCookie: u32(b, 40),
      formatSchematu: u32(b, 44),
      vychoziCache: u32(b, 48) | 0,
      nejvetsiKoren: u32(b, 52),
      kodovani: ({ 1: 'UTF-8', 2: 'UTF-16le', 3: 'UTF-16be' })[u32(b, 56)] || ('neznámé (' + u32(b, 56) + ')'),
      userVersion: u32(b, 60) | 0,
      inkrementalniVacuum: u32(b, 64) !== 0,
      applicationId: u32(b, 68) | 0,
      verzeSqlite: v ? Math.floor(v / 1000000) + '.' + Math.floor(v / 1000) % 1000 + '.' + v % 1000 : '–'
    };
    h.wal = h.verzeZapisu === 2 || h.verzeCteni === 2;
    if (![512, 1024, 2048, 4096, 8192, 16384, 32768, 65536].includes(ps)) { h.platne = false; h.chyba = 'Neplatná velikost stránky v hlavičce (' + ps + ').'; }
    return h;
  }

  /** Kopie souboru s hlavičkou přepnutou z WAL na klasický žurnál (sql.js neumí WAL ve virtuálním FS). Vstup zůstává beze změny. */
  function bezWal(b) {
    const k = new Uint8Array(b.length); k.set(b);
    if (k[18] === 2) k[18] = 1;
    if (k[19] === 2) k[19] = 1;
    return k;
  }

  function varint(b, o) {
    let v = 0;
    for (let i = 0; i < 8; i++) {
      const x = b[o + i];
      v = v * 128 + (x & 0x7f);
      if (!(x & 0x80)) return [v, i + 1];
    }
    return [v * 256 + b[o + 8], 9];
  }

  /** Lokální část payloadu a počet stránek přetečení (vzorec ze specifikace formátu souboru SQLite, oddíl 1.6). */
  function rozdelPayload(P, U, tabulkovyList) {
    const X = tabulkovyList ? U - 35 : Math.floor((U - 12) * 64 / 255) - 23;
    if (P <= X) return { lokalne: P, preteceni: 0 };
    const M = Math.floor((U - 12) * 32 / 255) - 23;
    const K = M + ((P - M) % (U - 4));
    const lokalne = K <= X ? K : M;
    return { lokalne, preteceni: Math.ceil((P - lokalne) / (U - 4)) };
  }

  /**
   * Projde B-stromy daných kořenů a spočítá stránky (obdoba virtuální tabulky dbstat).
   * koreny: [{nazev, typ, root}] – root 1 = sqlite_schema.
   * Vrací {objekty:[{nazev, typ, root, stranky, vnitrni, listy, preteceni, bunky, payload, nevyuzito, bajty}], celkem, freelist, ostatni, chyby}
   */
  function spocitejStranky(b, koreny) {
    const h = ctiHlavicku(b);
    if (!h.platne) throw new Error(h.chyba);
    const PS = h.velikostStranky, U = PS - h.rezerva;
    const celkem = Math.floor(b.length / PS);
    const navstiveno = new Uint8Array(celkem + 1);
    const chyby = [];
    const objekty = [];
    function strana(p) { return b.subarray((p - 1) * PS, p * PS); }
    for (const k of koreny) {
      const o = { nazev: k.nazev, typ: k.typ, root: k.root, stranky: 0, vnitrni: 0, listy: 0, preteceni: 0, bunky: 0, payload: 0, nevyuzito: 0 };
      objekty.push(o);
      if (!k.root || k.root < 1 || k.root > celkem) continue;
      const fronta = [k.root];
      let hlidac = 0;
      while (fronta.length) {
        const p = fronta.pop();
        if (p < 1 || p > celkem) { chyby.push(k.nazev + ': odkaz na stránku mimo soubor (' + p + ')'); continue; }
        if (navstiveno[p]) { chyby.push(k.nazev + ': stránka ' + p + ' použita vícekrát'); continue; }
        if (++hlidac > celkem + 5) { chyby.push(k.nazev + ': cyklus v B-stromu'); break; }
        navstiveno[p] = 1;
        o.stranky++;
        const s = strana(p);
        const ho = p === 1 ? 100 : 0;
        const typ = s[ho];
        const interni = typ === 0x05 || typ === 0x02;
        if (![0x05, 0x02, 0x0d, 0x0a].includes(typ)) { chyby.push(k.nazev + ': neznámý typ stránky ' + typ + ' (strana ' + p + ')'); continue; }
        const n = u16(s, ho + 3);
        let obsah = u16(s, ho + 5); if (obsah === 0) obsah = 65536;
        const hdr = ho + (interni ? 12 : 8);
        // volné místo = mezera mezi poli ukazatelů a obsahem + volné bloky + fragmenty
        let volne = obsah - (hdr + 2 * n);
        let fb = u16(s, ho + 1), ochrana = 0;
        while (fb && ochrana++ < 10000) { volne += u16(s, fb + 2); fb = u16(s, fb); }
        volne += s[ho + 7];
        o.nevyuzito += volne + (PS - U);
        if (interni) { o.vnitrni++; fronta.push(u32(s, ho + 8)); } else o.listy++;
        for (let i = 0; i < n; i++) {
          let c = u16(s, hdr + 2 * i);
          if (typ === 0x05) { fronta.push(u32(s, c)); continue; }
          if (typ === 0x02) { fronta.push(u32(s, c)); c += 4; }
          const [P, l1] = varint(s, c); c += l1;
          if (typ === 0x0d) { const [, l2] = varint(s, c); c += l2; o.bunky++; }
          if (typ === 0x0a || typ === 0x02) o.bunky++; // index: záznamy jsou v listech i ve vnitřních stránkách
          o.payload += P;
          const r = rozdelPayload(P, U, typ === 0x0d);
          if (r.preteceni) {
            // projít řetěz přetečení (ověřuje i vzorec)
            let ov = u32(s, c + r.lokalne), poc = 0;
            while (ov && poc < r.preteceni + 2) {
              if (ov > celkem || navstiveno[ov]) { chyby.push(k.nazev + ': vadný řetěz přetečení'); break; }
              navstiveno[ov] = 1; poc++;
              ov = u32(strana(ov), 0);
            }
            if (poc !== r.preteceni) chyby.push(k.nazev + ': délka řetězu přetečení ' + poc + ' ≠ ' + r.preteceni);
            o.preteceni += poc; o.stranky += poc;
            const zbytek = P - r.lokalne - (poc - 1) * (U - 4);
            if (poc) o.nevyuzito += (U - 4) - zbytek + (PS - U);
          }
        }
      }
      o.bajty = o.stranky * PS;
    }
    // freelist
    let freelist = 0, t = h.prvniFreelist, poj = 0;
    while (t && poj++ < celkem) {
      if (t > celkem || navstiveno[t]) { chyby.push('freelist: vadný odkaz'); break; }
      navstiveno[t] = 1; freelist++;
      const s = strana(t);
      const pocet = u32(s, 4);
      for (let i = 0; i < pocet && 8 + 4 * i + 4 <= PS; i++) {
        const l = u32(s, 8 + 4 * i);
        if (l >= 1 && l <= celkem && !navstiveno[l]) { navstiveno[l] = 1; freelist++; }
      }
      t = u32(s, 0);
    }
    let ostatni = 0;
    for (let p = 1; p <= celkem; p++) if (!navstiveno[p]) ostatni++;
    return { objekty, celkem, freelist, ostatni, velikostStranky: PS, chyby };
  }

  // ---------- ER diagram ----------
  /**
   * tabulky: [{nazev, sloupce:[{nazev, typ, pk}], fk:[{id, seq, table, from, to, on_update, on_delete}]}]
   * Vrací {uzly:[{nazev, sloupce, pk:Set}], hrany:[{id, z, zSloupce, do, doSloupce, onDelete, onUpdate, chybi, sama}]}
   */
  function erModel(tabulky) {
    const podleJmena = new Map(tabulky.map(t => [t.nazev.toLowerCase(), t]));
    const hrany = [];
    for (const t of tabulky) {
      const skup = new Map();
      for (const f of (t.fk || [])) {
        if (!skup.has(f.id)) skup.set(f.id, []);
        skup.get(f.id).push(f);
      }
      for (const [id, cast] of skup) {
        cast.sort((a, b) => a.seq - b.seq);
        const cil = podleJmena.get(String(cast[0].table).toLowerCase());
        let doSl = cast.map(f => f.to);
        if (doSl.some(x => x === null || x === undefined || x === '') && cil) {
          // REFERENCES t bez sloupců → PRIMARY KEY cílové tabulky
          const pk = cil.sloupce.filter(s => s.pk).sort((a, b) => a.pk - b.pk).map(s => s.nazev);
          doSl = pk.length ? pk : ['rowid'];
        }
        hrany.push({
          id: t.nazev + '#' + id, z: t.nazev, zSloupce: cast.map(f => f.from),
          do: cil ? cil.nazev : cast[0].table, doSloupce: doSl,
          onDelete: cast[0].on_delete || 'NO ACTION', onUpdate: cast[0].on_update || 'NO ACTION',
          chybi: !cil, sama: cil && cil.nazev === t.nazev
        });
      }
    }
    const uzly = tabulky.map(t => ({ nazev: t.nazev, typ: t.typ || 'table', sloupce: t.sloupce }));
    for (const hr of hrany) if (hr.chybi && !uzly.some(u => u.nazev === hr.do)) uzly.push({ nazev: hr.do, typ: 'chybi', sloupce: hr.doSloupce.map(n => ({ nazev: n, typ: '', pk: 0 })) });
    return { uzly, hrany };
  }

  /**
   * Vrstvené rozložení: odkazované (rodičovské) tabulky vlevo, závislé vpravo.
   * Vrací {pozice: {nazev: {x, y, w, h}}, sirka, vyska}.
   */
  function erRozlozeni(model, moz) {
    moz = Object.assign({ sirka: 210, radek: 20, hlava: 28, mezeraX: 90, mezeraY: 30, maxSloupcu: 40 }, moz || {});
    const jm = model.uzly.map(u => u.nazev);
    const rodice = new Map(jm.map(n => [n, new Set()]));
    for (const h of model.hrany) if (!h.sama && rodice.has(h.z) && rodice.has(h.do)) rodice.get(h.z).add(h.do);
    // vrstva = délka nejdelší cesty k rodičům (s ochranou proti cyklům)
    const vrstva = new Map();
    const stav = new Map();
    function v(n) {
      if (vrstva.has(n)) return vrstva.get(n);
      if (stav.get(n) === 1) return 0; // cyklus
      stav.set(n, 1);
      let m = 0;
      for (const r of rodice.get(n)) m = Math.max(m, v(r) + 1);
      stav.set(n, 2); vrstva.set(n, m);
      return m;
    }
    jm.forEach(v);
    const vrstvy = [];
    for (const n of jm) { const l = vrstva.get(n); (vrstvy[l] = vrstvy[l] || []).push(n); }
    for (let i = 0; i < vrstvy.length; i++) if (!vrstvy[i]) vrstvy[i] = [];
    // příliš vysoké vrstvy rozlámat, aby diagram nebyl nekonečně dlouhý
    const vyska = n => { const u = model.uzly.find(x => x.nazev === n); return moz.hlava + Math.min(u.sloupce.length, moz.maxSloupcu) * moz.radek + 8; };
    // barycentrické řazení (2 průchody)
    const poradi = new Map();
    vrstvy.forEach(l => l.forEach((n, i) => poradi.set(n, i)));
    const sousede = new Map(jm.map(n => [n, []]));
    for (const h of model.hrany) if (!h.sama && sousede.has(h.z) && sousede.has(h.do)) { sousede.get(h.z).push(h.do); sousede.get(h.do).push(h.z); }
    for (let pr = 0; pr < 3; pr++) {
      for (const l of vrstvy) {
        const bc = new Map(l.map(n => {
          const s = sousede.get(n).map(x => poradi.get(x));
          return [n, s.length ? s.reduce((a, b) => a + b, 0) / s.length : poradi.get(n)];
        }));
        l.sort((a, b) => bc.get(a) - bc.get(b));
        l.forEach((n, i) => poradi.set(n, i));
      }
    }
    const pozice = {};
    let x = 20, maxY = 0;
    const limitVysky = Math.max(900, Math.sqrt(jm.length) * 260);
    for (const l of vrstvy) {
      let y = 20, sl = 0;
      for (const n of l) {
        const hh = vyska(n);
        if (y > 20 && y + hh > limitVysky) { y = 20; sl++; }
        pozice[n] = { x: x + sl * (moz.sirka + moz.mezeraX * 0.6), y, w: moz.sirka, h: hh };
        y += hh + moz.mezeraY; maxY = Math.max(maxY, y);
      }
      if (l.length) x += (sl + 1) * (moz.sirka + moz.mezeraX * 0.6) + moz.mezeraX * 0.4;
    }
    return { pozice, sirka: x + 20, vyska: maxY + 20 };
  }

  // ---------- grafy ----------
  function naCislo(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
    return null;
  }
  /** Navrhne osu X a číselné sloupce Y. */
  function navrhniGraf(sloupce, radky) {
    const vzorek = radky.slice(0, 200);
    const ciselne = sloupce.map((_, i) => vzorek.length > 0 && vzorek.filter(r => r[i] !== null).every(r => naCislo(r[i]) !== null) && vzorek.some(r => r[i] !== null));
    let x = ciselne.findIndex(c => !c);
    const y = [];
    ciselne.forEach((c, i) => { if (c && i !== x) y.push(i); });
    if (x < 0) { x = 0; y.splice(y.indexOf(0), 1); }
    return { x, y: y.slice(0, 4), ciselne, typ: x >= 0 && ciselne[x] ? 'line' : 'bar' };
  }
  /**
   * Data pro graf. moz: {x, y:[...], agregace:'zadna'|'soucet'|'prumer'|'pocet'|'min'|'max', max, typ}
   * Vrací {popisky, rady:[{nazev, data}], body (scatter), pocetVstupnich, oriznuto, vynechano}
   */
  function pripravGraf(sloupce, radky, moz) {
    const max = moz.max || 2000;
    const ag = moz.agregace || 'zadna';
    const ys = moz.y || [];
    let vynechano = 0;
    if (moz.typ === 'scatter') {
      const rady = ys.map(y => ({ nazev: sloupce[y], data: [] }));
      for (const r of radky) {
        const xv = naCislo(r[moz.x]);
        ys.forEach((y, k) => { const yv = naCislo(r[y]); if (xv === null || yv === null) vynechano++; else if (rady[k].data.length < max) rady[k].data.push({ x: xv, y: yv }); });
      }
      return { popisky: null, rady, pocetVstupnich: radky.length, oriznuto: radky.length > max, vynechano };
    }
    if (ag !== 'zadna') {
      const skup = new Map();
      for (const r of radky) {
        const k = r[moz.x] === null ? '∅ NULL' : (r[moz.x] instanceof Uint8Array ? 'BLOB' : String(r[moz.x]));
        if (!skup.has(k)) skup.set(k, ys.map(() => ({ s: 0, n: 0, min: Infinity, max: -Infinity, vse: 0 })));
        const a = skup.get(k);
        ys.forEach((y, j) => {
          a[j].vse++;
          const v = naCislo(r[y]); if (v === null) { if (ag !== 'pocet') vynechano++; return; }
          a[j].s += v; a[j].n++; a[j].min = Math.min(a[j].min, v); a[j].max = Math.max(a[j].max, v);
        });
      }
      let klice = [...skup.keys()];
      const ciselneX = klice.every(k => k !== '∅ NULL' && !isNaN(Number(k)));
      if (ciselneX) klice.sort((a, b) => Number(a) - Number(b));
      const oriznuto = klice.length > max;
      klice = klice.slice(0, max);
      const f = { soucet: a => a.s, prumer: a => a.n ? a.s / a.n : null, pocet: a => moz.y && moz.y.length ? a.n : a.vse, min: a => a.n ? a.min : null, max: a => a.n ? a.max : null }[ag];
      const rady = ys.map((y, j) => ({ nazev: sloupce[y] + ' (' + ({ soucet: 'součet', prumer: 'průměr', pocet: 'počet', min: 'minimum', max: 'maximum' })[ag] + ')', data: klice.map(k => f(skup.get(k)[j])) }));
      return { popisky: klice, rady, pocetVstupnich: radky.length, oriznuto, vynechano };
    }
    const vzorek = radky.slice(0, max);
    const popisky = vzorek.map(r => r[moz.x] === null ? '∅' : r[moz.x] instanceof Uint8Array ? 'BLOB' : String(r[moz.x]));
    const rady = ys.map(y => ({ nazev: sloupce[y], data: vzorek.map(r => { const v = naCislo(r[y]); if (v === null) vynechano++; return v; }) }));
    return { popisky, rady, pocetVstupnich: radky.length, oriznuto: radky.length > max, vynechano };
  }

  // ---------- přenos hodnot do UI ----------
  /** Zkrácená hodnota pro zobrazení (dlouhé texty a BLOBy se neposílají celé). */
  function proPrenos(v, maxText) {
    maxText = maxText || 2000;
    if (v instanceof Uint8Array) return { t: 'blob', n: v.length, hex: hexRetezec(v, 48), obr: typObrazku(v) };
    if (typeof v === 'string' && v.length > maxText) return { t: 'dlouhy', n: v.length, s: v.slice(0, maxText) };
    return v;
  }
  function typObrazku(u8) {
    if (u8.length > 4 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'image/png';
    if (u8.length > 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg';
    if (u8.length > 4 && u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'image/gif';
    if (u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[8] === 0x57 && u8[9] === 0x45) return 'image/webp';
    return null;
  }
  /** Odhad paměti hodnoty v bajtech (pro limity výsledků). */
  function odhadPameti(v) {
    if (v === null || v === undefined) return 8;
    if (typeof v === 'string') return 16 + v.length * 2;
    if (v instanceof Uint8Array) return 64 + v.length;
    return 16;
  }

  // ---------- formátování (cs) ----------
  function formatCislo(n, des) {
    if (n === null || n === undefined || n === '') return '–';
    if (typeof n === 'bigint') return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (!Number.isFinite(n)) return String(n);
    return n.toLocaleString('cs-CZ', { maximumFractionDigits: des == null ? 2 : des, minimumFractionDigits: 0 });
  }
  function formatBajty(n) {
    if (n == null || !Number.isFinite(n)) return '–';
    const j = ['B', 'kB', 'MB', 'GB', 'TB'];
    let i = 0, x = n;
    while (x >= 1024 && i < j.length - 1) { x /= 1024; i++; }
    return (i === 0 ? String(x) : x.toLocaleString('cs-CZ', { maximumFractionDigits: x < 10 ? 2 : 1 })) + ' ' + j[i];
  }
  function formatCas(ms) {
    if (ms < 1) return '< 1 ms';
    if (ms < 1000) return Math.round(ms) + ' ms';
    return (ms / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 2 }) + ' s';
  }

  // ---------- ukázková databáze ----------
  const DEMO_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE kategorie (
  id INTEGER PRIMARY KEY,
  nazev TEXT NOT NULL UNIQUE,
  nadrazena_id INTEGER REFERENCES kategorie(id) ON DELETE SET NULL
);
CREATE TABLE zakaznici (
  id INTEGER PRIMARY KEY,
  jmeno TEXT NOT NULL,
  email TEXT UNIQUE,
  mesto TEXT,
  registrace TEXT NOT NULL DEFAULT (date('now'))
);
CREATE TABLE produkty (
  id INTEGER PRIMARY KEY,
  kod TEXT NOT NULL UNIQUE,
  nazev TEXT NOT NULL,
  kategorie_id INTEGER NOT NULL REFERENCES kategorie(id),
  cena REAL NOT NULL CHECK (cena >= 0),
  sklad INTEGER NOT NULL DEFAULT 0,
  obrazek BLOB
);
CREATE TABLE objednavky (
  id INTEGER PRIMARY KEY,
  zakaznik_id INTEGER NOT NULL REFERENCES zakaznici(id) ON DELETE CASCADE,
  datum TEXT NOT NULL,
  stav TEXT NOT NULL DEFAULT 'nová' CHECK (stav IN ('nová','zaplacená','odeslaná','zrušená'))
);
CREATE TABLE polozky (
  objednavka_id INTEGER NOT NULL REFERENCES objednavky(id) ON DELETE CASCADE,
  radek INTEGER NOT NULL,
  produkt_id INTEGER NOT NULL REFERENCES produkty(id),
  mnozstvi INTEGER NOT NULL CHECK (mnozstvi > 0),
  cena_ks REAL NOT NULL,
  PRIMARY KEY (objednavka_id, radek)
) WITHOUT ROWID;
CREATE TABLE sklady (kod TEXT PRIMARY KEY, mesto TEXT NOT NULL) STRICT;
CREATE TABLE zasoby (
  sklad_kod TEXT NOT NULL,
  produkt_id INTEGER NOT NULL,
  kusu INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sklad_kod, produkt_id),
  FOREIGN KEY (sklad_kod) REFERENCES sklady(kod) ON UPDATE CASCADE,
  FOREIGN KEY (produkt_id) REFERENCES produkty
);
CREATE INDEX ix_objednavky_zakaznik ON objednavky(zakaznik_id);
CREATE INDEX ix_objednavky_datum ON objednavky(datum);
CREATE INDEX ix_polozky_produkt ON polozky(produkt_id);
CREATE INDEX ix_produkty_kategorie ON produkty(kategorie_id, cena DESC);
CREATE VIEW trzby_po_mesicich AS
  SELECT substr(o.datum, 1, 7) AS mesic, count(DISTINCT o.id) AS objednavek,
         round(sum(p.mnozstvi * p.cena_ks), 2) AS trzba
  FROM objednavky o JOIN polozky p ON p.objednavka_id = o.id
  WHERE o.stav <> 'zrušená' GROUP BY mesic ORDER BY mesic;
CREATE VIEW nejprodavanejsi AS
  SELECT pr.nazev, k.nazev AS kategorie, sum(p.mnozstvi) AS kusu
  FROM polozky p JOIN produkty pr ON pr.id = p.produkt_id JOIN kategorie k ON k.id = pr.kategorie_id
  GROUP BY pr.id ORDER BY kusu DESC;
CREATE TRIGGER odecti_sklad AFTER INSERT ON polozky BEGIN
  UPDATE produkty SET sklad = sklad - NEW.mnozstvi WHERE id = NEW.produkt_id;
END;
INSERT INTO kategorie(id, nazev, nadrazena_id) VALUES
  (1,'Nářadí',NULL),(2,'Ruční nářadí',1),(3,'Elektrické nářadí',1),(4,'Zahrada',NULL),(5,'Zavlažování',4),(6,'Spojovací materiál',NULL);
INSERT INTO zakaznici(id, jmeno, email, mesto, registrace)
  WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 400)
  SELECT i,
    (CASE i % 8 WHEN 0 THEN 'Jana' WHEN 1 THEN 'Petr' WHEN 2 THEN 'Eva' WHEN 3 THEN 'Tomáš' WHEN 4 THEN 'Lucie' WHEN 5 THEN 'Martin' WHEN 6 THEN 'Šárka' ELSE 'Jiří' END)
      || ' ' || (CASE (i * 7) % 6 WHEN 0 THEN 'Nováková' WHEN 1 THEN 'Dvořák' WHEN 2 THEN 'Černá' WHEN 3 THEN 'Procházka' WHEN 4 THEN 'Kučerová' ELSE 'Veselý' END),
    'zakaznik' || i || '@example.cz',
    CASE (i * 13) % 5 WHEN 0 THEN 'Praha' WHEN 1 THEN 'Brno' WHEN 2 THEN 'Ostrava' WHEN 3 THEN 'Plzeň' ELSE NULL END,
    date('2024-01-01', '+' || ((i * 37) % 600) || ' days')
  FROM n;
INSERT INTO produkty(id, kod, nazev, kategorie_id, cena, sklad)
  WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 60)
  SELECT i, printf('P-%04d', i),
    (CASE i % 6 WHEN 0 THEN 'Šroubovák' WHEN 1 THEN 'Kladivo' WHEN 2 THEN 'Vrtačka' WHEN 3 THEN 'Hadice' WHEN 4 THEN 'Postřikovač' ELSE 'Vruty' END) || ' ' || i,
    CASE i % 6 WHEN 0 THEN 2 WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 5 WHEN 4 THEN 5 ELSE 6 END,
    round(49 + ((i * 7919) % 2500) / 1.7, 2), 1000 + (i * 31) % 400
  FROM n;
INSERT INTO objednavky(id, zakaznik_id, datum, stav)
  WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 2500)
  SELECT i, 1 + (i * 7907) % 400, date('2025-01-01', '+' || ((i * 211) % 365) || ' days'),
    CASE WHEN i % 23 = 0 THEN 'zrušená' WHEN i % 7 = 0 THEN 'nová' WHEN i % 3 = 0 THEN 'zaplacená' ELSE 'odeslaná' END
  FROM n;
INSERT INTO polozky(objednavka_id, radek, produkt_id, mnozstvi, cena_ks)
  WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i < 7499)
  SELECT 1 + i / 3, 1 + i % 3, p.id, 1 + (i * 17) % 5, p.cena
  FROM n JOIN produkty p ON p.id = 1 + (i * 7919 + i / 3) % 60;
INSERT INTO sklady VALUES ('PHA','Praha'),('BRN','Brno');
INSERT INTO zasoby SELECT 'PHA', id, sklad / 2 FROM produkty;
INSERT INTO zasoby SELECT 'BRN', id, sklad - sklad / 2 FROM produkty WHERE id % 2 = 0;
UPDATE produkty SET obrazek = X'89504E470D0A1A0A0000000D49484452000000080000000808020000004B6D29DC0000006D49444154789C15CE4115005108425193988424243109495E1212CD1F975C0F3A33ECA0C1C30D19183ACC2CBB68F1724B1696EE03B142C2E24404A27A60D6C8D89C89C1D40F8E3D74F8B8230747EF41D8A0E0702181D03CF88FBDDA57F0565FF84FDF6B53B6A8B85C49FFB8E503B77761817C535FC90000000049454E44AE426082' WHERE id <= 3;
ANALYZE;
`;

  const API = {
    q, lit, hexRetezec, typHodnoty, normalizujRadek, porovnej, seradIndexy,
    rozeberFiltr, splnujeFiltr, filtrNaSql, filtrujIndexy, escLike, vyberRowidAlias, sestavDotazProhlizeni, whereKlic,
    csvPole, naCsv, naCsvKusy, naJson, naJsonKusy, jsonHodnota, jsonKlice, jsonObjekt,
    tokenizuj, rozdelPrikazy, prikazNaPozici, prvniSlovo, ridiTransakce, KLICOVA, FUNKCE,
    stromPlanu, ctiHlavicku, bezWal, varint, rozdelPayload, spocitejStranky,
    erModel, erRozlozeni, naCislo, navrhniGraf, pripravGraf,
    proPrenos, typObrazku, odhadPameti, formatCislo, formatBajty, formatCas, DEMO_SQL
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else (typeof self !== 'undefined' ? self : window).SqlJadro = API;
})();
