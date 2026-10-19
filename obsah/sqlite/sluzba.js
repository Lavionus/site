/* ============================================================
   SQLite prohlížeč – služba nad sql.js (běží ve Web Workeru,
   v testech přímo v node). Drží databázi v paměti, uložené
   výsledky dotazů, stav transakce a zásobník úprav.
   Původní soubor se nikdy nemění: sql.js si data zkopíruje
   do virtuálního FS a export vrací vždy novou kopii.
   ============================================================ */
(function () {
  'use strict';
  const J = (typeof module !== 'undefined' && module.exports) ? require('./jadro.js') : self.SqlJadro;
  const { q } = J;
  const VYCHOZI = { maxRadku: 50000, maxPamet: 256 * 1024 * 1024, maxText: 2000, bezpecnyRezim: true, ciziKlice: true, jenCteni: false };

  function Sluzba(SQL) {
    this.SQL = SQL;
    this.db = null;
    this.info = null;
    this.vysledky = new Map();
    this.dalsiId = 1;
    this.nast = Object.assign({}, VYCHOZI);
    this.upravy = [];          // zásobník savepointů jednotlivých úprav
    this.mameAutoTx = false;   // transakci otevřela aplikace (ne uživatel)
    this.zmenyPriStartuTx = 0;
    this.upraveno = false;     // obsah v paměti se liší od načteného souboru
  }
  const P = Sluzba.prototype;

  // ---------- pomocné ----------
  P._db = function () { if (!this.db) throw new Error('Není otevřená žádná databáze.'); return this.db; };
  P._vse = function (sql, params) {
    const st = this._db().prepare(sql);
    try {
      if (params && params.length) st.bind(params);
      const r = [];
      while (st.step()) r.push(J.normalizujRadek(st.get(null, { useBigInt: true })));
      return { sloupce: st.getColumnNames(), radky: r };
    } finally { st.free(); }
  };
  P._jedna = function (sql, params) { const r = this._vse(sql, params).radky; return r.length ? r[0][0] : null; };
  P._objekty = function (sql, params) {
    const v = this._vse(sql, params);
    return v.radky.map(r => Object.fromEntries(v.sloupce.map((s, i) => [s, r[i]])));
  };
  /** Je otevřená transakce? (BEGIN uvnitř transakce selže – spolehlivé i když ji otevřel uživatel v SQL) */
  P.vTransakci = function () {
    const db = this._db();
    try { db.exec('BEGIN'); } catch (e) { if (/within a transaction/i.test(e.message)) return true; throw e; }
    db.exec('ROLLBACK');
    return false;
  };
  P._celkemZmen = function () { return Number(this._jedna('SELECT total_changes()')); };
  P._verzeSchematu = function () { return Number(this._jedna('PRAGMA schema_version')); };
  P._pragmaSpojeni = function () {
    const db = this._db();
    try { db.exec('PRAGMA foreign_keys = ' + (this.nast.ciziKlice ? 'ON' : 'OFF')); } catch (e) { /* uvnitř transakce se nemění */ }
    db.exec('PRAGMA query_only = ' + (this.nast.jenCteni ? 'ON' : 'OFF'));
  };
  P._zahajTx = function () {
    if (!this.vTransakci()) {
      this._db().exec('BEGIN');
      this.mameAutoTx = true;
      this.zmenyPriStartuTx = this._celkemZmen();
      this.schemaPriStartuTx = this._verzeSchematu();
    }
  };

  // ---------- otevření ----------
  P._nastavDb = function (db, info) {
    if (this.db) try { this.db.close(); } catch (e) { /* nic */ }
    this.db = db; this.info = info;
    this.vysledky.clear(); this.upravy = []; this.mameAutoTx = false; this.upraveno = false;
    this._pragmaSpojeni();
    return Object.assign({}, info, { schema: this.schema() });
  };
  /** data: ArrayBuffer | Uint8Array; vstup se nemění (sql.js data kopíruje do svého FS). */
  P.otevri = function ({ data, nazev }) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const h = J.ctiHlavicku(u8);
    if (!h.platne) throw new Error(h.chyba);
    const upozorneni = [];
    let zdroj = u8;
    if (h.wal) {
      zdroj = J.bezWal(u8);
      upozorneni.push('Databáze je v režimu WAL. Prohlížeč pracuje jen s hlavním souborem – změny, které zůstaly v souboru „-wal" (neprovedený checkpoint), nejsou vidět. Hlavička kopie v paměti byla přepnuta na klasický žurnál; původní soubor zůstává beze změny.');
    }
    if (u8.length % h.velikostStranky) upozorneni.push('Velikost souboru není násobkem velikosti stránky – soubor může být useknutý.');
    const db = new this.SQL.Database(zdroj);
    try { db.exec('SELECT count(*) FROM sqlite_schema'); } catch (e) { db.close(); throw new Error('Databázi nelze přečíst: ' + e.message); }
    return this._nastavDb(db, { nazev: nazev || 'databaze.sqlite', velikost: u8.length, hlavicka: h, upozorneni, zdroj: 'soubor' });
  };
  P.nova = function () {
    return this._nastavDb(new this.SQL.Database(), { nazev: 'nova.sqlite', velikost: 0, hlavicka: null, upozorneni: [], zdroj: 'nová' });
  };
  P.demo = function () {
    const db = new this.SQL.Database();
    db.exec(J.DEMO_SQL);
    const r = this._nastavDb(db, { nazev: 'ukazka-eshop.sqlite', velikost: 0, hlavicka: null, upozorneni: [], zdroj: 'ukázka' });
    return r;
  };

  // ---------- schéma ----------
  P.schema = function () {
    const objekty = this._objekty("SELECT type AS typ, name AS nazev, tbl_name AS tabulka, rootpage AS root, sql FROM sqlite_schema ORDER BY type, name");
    let seznam = [];
    try { seznam = this._objekty("SELECT name, type, ncol, wr, strict FROM pragma_table_list WHERE schema = 'main'"); } catch (e) { /* starší SQLite */ }
    const info = new Map(seznam.map(t => [t.name, t]));
    const tabulky = [];
    for (const o of objekty) {
      if (o.typ !== 'table' && o.typ !== 'view') continue;
      const t = { nazev: o.nazev, typ: o.typ, sql: o.sql, root: o.root, systemova: /^sqlite_/i.test(o.nazev) };
      t.virtualni = o.typ === 'table' && /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(o.sql || '');
      const ti = info.get(o.nazev);
      t.bezRowid = ti ? !!ti.wr : /WITHOUT\s+ROWID\s*;?\s*$/i.test(o.sql || '');
      t.strict = ti ? !!ti.strict : false;
      try {
        t.sloupce = this._objekty('SELECT cid, name AS nazev, type AS typ, "notnull" AS nenull, dflt_value AS vychozi, pk, hidden FROM pragma_table_xinfo(?)', [o.nazev]);
        t.sloupce.forEach(s => { s.skryty = s.hidden === 1; s.generovany = s.hidden === 2 || s.hidden === 3; });
      } catch (e) { t.sloupce = []; t.chyba = e.message; }
      try { t.fk = this._objekty('SELECT id, seq, "table", "from", "to", on_update, on_delete, "match" FROM pragma_foreign_key_list(?)', [o.nazev]); } catch (e) { t.fk = []; }
      try {
        t.indexy = this._objekty('SELECT name AS nazev, "unique" AS unikatni, origin AS puvod, partial AS castecny FROM pragma_index_list(?)', [o.nazev]);
        for (const ix of t.indexy) ix.sloupce = this._objekty('SELECT seqno, cid, name AS nazev, "desc" AS sestupne, coll AS kolace, key AS klic FROM pragma_index_xinfo(?) WHERE key = 1', [ix.nazev]);
      } catch (e) { t.indexy = []; }
      t.klic = this._klicTabulky(t);
      tabulky.push(t);
    }
    const er = J.erModel(tabulky.filter(t => t.typ === 'table' && !t.systemova).map(t => ({ nazev: t.nazev, sloupce: t.sloupce.filter(s => !s.skryty).map(s => ({ nazev: s.nazev, typ: s.typ, pk: s.pk })), fk: t.fk })));
    return { objekty, tabulky, er, verze: this._verzeSchematu() };
  };

  /** Jak jednoznačně určit řádek: rowid (nezastíněný alias), PRIMARY KEY u WITHOUT ROWID, u pohledů nic. */
  P._klicTabulky = function (t) {
    if (t.typ === 'view') return { typ: 'zadny', duvod: 'Pohled (VIEW) nelze upravovat přímo – upravte podkladové tabulky.' };
    if (t.virtualni) return { typ: 'zadny', duvod: 'Virtuální tabulku nelze upravovat přes tento editor (použijte SQL).' };
    if (t.bezRowid) {
      const pk = t.sloupce.filter(s => s.pk).sort((a, b) => a.pk - b.pk).map(s => s.nazev);
      return pk.length ? { typ: 'pk', sloupce: pk } : { typ: 'zadny', duvod: 'Tabulka WITHOUT ROWID bez PRIMARY KEY.' };
    }
    const alias = J.vyberRowidAlias(t.sloupce.map(s => s.nazev));
    if (alias) return { typ: 'rowid', alias };
    const pk = t.sloupce.filter(s => s.pk).sort((a, b) => a.pk - b.pk).map(s => s.nazev);
    return pk.length ? { typ: 'pk', sloupce: pk } : { typ: 'zadny', duvod: 'Všechny aliasy rowid jsou zastíněné sloupci a tabulka nemá PRIMARY KEY.' };
  };
  P._tabulka = function (nazev) {
    const t = this.schema().tabulky.find(x => x.nazev === nazev);
    if (!t) throw new Error('Tabulka „' + nazev + '" neexistuje.');
    return t;
  };

  P.pocty = function () {
    const out = {};
    for (const t of this.schema().tabulky) {
      if (t.typ !== 'table') continue;
      try { out[t.nazev] = Number(this._jedna('SELECT count(*) FROM ' + q(t.nazev))); } catch (e) { out[t.nazev] = null; }
    }
    return out;
  };

  // ---------- prohlížení tabulky ----------
  P.prohlizej = function (o) {
    const t = this._tabulka(o.tabulka);
    const viditelne = t.sloupce.filter(s => !s.skryty);
    const sloupce = viditelne.map(s => s.nazev);
    const klic = t.klic.typ === 'zadny' ? null : t.klic;
    const d = J.sestavDotazProhlizeni({ tabulka: t.nazev, sloupce, klic, filtry: o.filtry, hledat: o.hledat, razeni: o.razeni, limit: o.limit, offset: o.offset });
    const t0 = Date.now();
    const v = this._vse(d.sql, d.params);
    const celkem = Number(this._jedna(d.sqlPocet, d.paramsPocet));
    const n = d.pocetKlicu;
    return {
      sloupce, typy: viditelne.map(s => s.typ), generovane: viditelne.map(s => s.generovany),
      klice: v.radky.map(r => r.slice(0, n)),
      radky: v.radky.map(r => r.slice(n).map(x => J.proPrenos(x, this.nast.maxText))),
      celkem, offset: o.offset | 0, cas: Date.now() - t0,
      editovatelna: !!klic && !this.nast.jenCteni, duvod: klic ? (this.nast.jenCteni ? 'Zapnut režim jen pro čtení.' : null) : t.klic.duvod,
      sql: d.sql
    };
  };

  /** Celá hodnota buňky (dlouhý text / BLOB ke stažení). */
  P.hodnota = function ({ tabulka, klic, sloupec, vysledek, radek }) {
    if (vysledek != null) {
      const r = this.vysledky.get(vysledek);
      if (!r) throw new Error('Výsledek už není v paměti.');
      return r.radky[radek][sloupec];
    }
    const t = this._tabulka(tabulka);
    const w = J.whereKlic(t.klic, klic);
    return this._jedna('SELECT ' + q(sloupec) + ' FROM ' + q(tabulka) + ' WHERE ' + w.sql, w.params);
  };

  // ---------- úpravy (vždy v transakci, každá úprava = savepoint) ----------
  P._uprava = function (popis, fn) {
    if (this.nast.jenCteni) throw new Error('Je zapnutý režim jen pro čtení.');
    this._zahajTx();
    const db = this._db();
    const sp = 'uprava_' + (this.upravy.length + 1) + '_' + Date.now().toString(36);
    db.exec('SAVEPOINT ' + q(sp));
    try {
      const r = fn();
      this.upravy.push({ sp, popis });
      return Object.assign({ stav: this.stav() }, r);
    } catch (e) {
      try { db.exec('ROLLBACK TO ' + q(sp)); db.exec('RELEASE ' + q(sp)); } catch (e2) { /* transakce mohla zaniknout */ }
      throw e;
    }
  };

  P.upravBunku = function ({ tabulka, klic, sloupec, hodnota }) {
    const t = this._tabulka(tabulka);
    if (t.klic.typ === 'zadny') throw new Error(t.klic.duvod);
    const sl = t.sloupce.find(s => s.nazev === sloupec);
    if (!sl) throw new Error('Sloupec „' + sloupec + '" neexistuje.');
    if (sl.generovany) throw new Error('Generovaný sloupec nelze upravit.');
    return this._uprava('Úprava ' + tabulka + '.' + sloupec, () => {
      const w = J.whereKlic(t.klic, klic);
      const st = this._db().prepare('UPDATE ' + q(tabulka) + ' SET ' + q(sloupec) + ' = ? WHERE ' + w.sql);
      try { st.run([hodnota === undefined ? null : hodnota].concat(w.params)); } finally { st.free(); }
      const n = this._db().getRowsModified();
      if (n !== 1) throw new Error(n === 0 ? 'Řádek se nenašel (mezitím smazán nebo změněn klíč).' : 'Úprava by změnila ' + n + ' řádků – zrušeno.');
      // nový klíč (mohl se změnit PRIMARY KEY / INTEGER PRIMARY KEY)
      let novyKlic = klic.slice();
      if (t.klic.typ === 'pk') { const i = t.klic.sloupce.indexOf(sloupec); if (i >= 0) novyKlic[i] = hodnota; }
      else if (sl.pk && /^INTEGER$/i.test(sl.typ.trim()) && t.sloupce.filter(s => s.pk).length === 1) novyKlic = [hodnota];
      const w2 = J.whereKlic(t.klic, novyKlic);
      const nova = this._jedna('SELECT ' + q(sloupec) + ' FROM ' + q(tabulka) + ' WHERE ' + w2.sql, w2.params);
      return { hodnota: J.proPrenos(nova, this.nast.maxText), typ: J.typHodnoty(nova), klic: novyKlic };
    });
  };

  P.vlozRadek = function ({ tabulka, hodnoty }) {
    const t = this._tabulka(tabulka);
    if (t.typ !== 'table' || t.virtualni) throw new Error('Do pohledu ani virtuální tabulky nelze vkládat.');
    return this._uprava('Nový řádek v ' + tabulka, () => {
      const sl = Object.keys(hodnoty || {});
      const sql = sl.length
        ? 'INSERT INTO ' + q(tabulka) + ' (' + sl.map(q).join(', ') + ') VALUES (' + sl.map(() => '?').join(', ') + ')'
        : 'INSERT INTO ' + q(tabulka) + ' DEFAULT VALUES';
      const st = this._db().prepare(sql);
      try { st.run(sl.map(s => hodnoty[s])); } finally { st.free(); }
      return { rowid: t.bezRowid ? null : Number(this._jedna('SELECT last_insert_rowid()')) };
    });
  };

  P.smazRadky = function ({ tabulka, klice }) {
    const t = this._tabulka(tabulka);
    if (t.klic.typ === 'zadny') throw new Error(t.klic.duvod);
    return this._uprava('Smazání ' + klice.length + ' ř. z ' + tabulka, () => {
      let n = 0;
      for (const k of klice) {
        const w = J.whereKlic(t.klic, k);
        const st = this._db().prepare('DELETE FROM ' + q(tabulka) + ' WHERE ' + w.sql);
        try { st.run(w.params); } finally { st.free(); }
        n += this._db().getRowsModified();
      }
      return { smazano: n };
    });
  };

  P.zpet = function () {
    const u = this.upravy.pop();
    if (!u) throw new Error('Není co vrátit.');
    if (!this.vTransakci()) { this.upravy = []; throw new Error('Transakce už byla ukončena.'); }
    const db = this._db();
    db.exec('ROLLBACK TO ' + q(u.sp)); db.exec('RELEASE ' + q(u.sp));
    return { vraceno: u.popis, stav: this.stav() };
  };

  // ---------- transakce ----------
  P.stav = function () {
    if (!this.db) return { otevrena: false };
    const tx = this.vTransakci();
    if (!tx) { this.mameAutoTx = false; this.upravy = []; }
    const celk = this._celkemZmen();
    return {
      otevrena: true, transakce: tx, autoTx: this.mameAutoTx,
      zmenVTx: tx && this.mameAutoTx ? celk - this.zmenyPriStartuTx : null,
      schemaZmeneno: tx && this.mameAutoTx ? this._verzeSchematu() !== this.schemaPriStartuTx : false,
      upravy: this.upravy.map(u => u.popis), upraveno: this.upraveno, nastaveni: this.nast
    };
  };
  P.commit = function () {
    if (!this.vTransakci()) throw new Error('Žádná transakce není otevřená.');
    const db = this._db();
    db.exec('COMMIT');
    this.upraveno = true; this.mameAutoTx = false; this.upravy = [];
    this._pragmaSpojeni();
    return this.stav();
  };
  P.rollback = function () {
    if (!this.vTransakci()) throw new Error('Žádná transakce není otevřená.');
    this._db().exec('ROLLBACK');
    this.mameAutoTx = false; this.upravy = [];
    this._pragmaSpojeni();
    return this.stav();
  };
  P.nastav = function (n) {
    Object.assign(this.nast, n || {});
    if (this.db) this._pragmaSpojeni();
    return this.stav();
  };

  // ---------- SQL dotazy ----------
  /**
   * Spustí skript. V bezpečném režimu se změny dějí uvnitř transakce (BEGIN automaticky),
   * pokud skript sám neřídí transakce. Vrací přehled příkazů a uložený poslední výsledek s řádky.
   */
  P.dotaz = function ({ sql, params, maxRadku }) {
    const db = this._db();
    const limit = Math.max(1, Math.min(5000000, maxRadku || this.nast.maxRadku));
    const ridi = J.ridiTransakce(sql);
    let zahajeno = false;
    if (this.nast.bezpecnyRezim && !ridi && !this.vTransakci()) { this._zahajTx(); zahajeno = true; }
    const zmenyPred = this._celkemZmen(), schemaPred = this._verzeSchematu();
    const prikazy = [];
    let posledni = null, chyba = null;
    const t0 = now();
    try {
      for (const st of db.iterateStatements(sql)) {
        const p = { sql: st.getSQL().trim(), sloupce: st.getColumnNames(), radku: 0, zmeneno: 0, cas: 0 };
        const ts = now();
        if (params && prikazy.length === 0) st.bind(params);
        const zmenyTed = this._celkemZmen();
        if (p.sloupce.length) {
          const radky = []; let pamet = 0, oriznuto = false;
          while (st.step()) {
            if (radky.length >= limit || pamet > this.nast.maxPamet) { oriznuto = true; break; }
            const r = J.normalizujRadek(st.get(null, { useBigInt: true }));
            for (const v of r) pamet += J.odhadPameti(v);
            radky.push(r);
          }
          p.radku = radky.length; p.oriznuto = oriznuto; p.pamet = pamet;
          posledni = { sloupce: p.sloupce, radky, oriznuto, sql: p.sql, pamet };
        } else {
          while (st.step()) { /* příkaz bez výsledku */ }
        }
        p.zmeneno = this._celkemZmen() - zmenyTed;
        p.cas = now() - ts;
        prikazy.push(p);
      }
    } catch (e) {
      chyba = e.message;
    }
    const cas = now() - t0;
    let zmeny = this._celkemZmen() - zmenyPred;
    const schemaZmena = this._verzeSchematu() !== schemaPred;
    // naše automatická transakce bez jakékoli změny → zavřít, ať zbytečně nevisí
    if (zahajeno && zmeny === 0 && !schemaZmena && this.upravy.length === 0) {
      try { if (this.vTransakci()) db.exec('ROLLBACK'); } catch (e) { /* nic */ }
      this.mameAutoTx = false;
    }
    if (ridi && J.rozdelPrikazy(sql).some(p => J.prvniSlovo(p.sql) === 'VACUUM') && !chyba) this.upraveno = true;
    if (ridi) { this.upravy = []; if (!this.vTransakci()) { this.mameAutoTx = false; if (zmeny || schemaZmena) this.upraveno = true; } }
    if (!this.nast.bezpecnyRezim && !this.vTransakci() && (zmeny || schemaZmena)) this.upraveno = true;
    let vysledek = null;
    if (posledni) {
      const id = this.dalsiId++;
      // uchovat jen několik posledních výsledků (paměť)
      this.vysledky.set(id, Object.assign(posledni, { cache: null }));
      while (this.vysledky.size > 3) this.vysledky.delete(this.vysledky.keys().next().value);
      vysledek = Object.assign({ id, sloupce: posledni.sloupce, celkem: posledni.radky.length, oriznuto: posledni.oriznuto, pamet: posledni.pamet }, this.stranka({ id, offset: 0, limit: 100 }));
    }
    return { prikazy, chyba, cas, zmeny, schemaZmena, vysledek, stav: this.stav() };
  };

  function now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  /** Stránka uloženého výsledku s filtry a řazením (v paměti workeru). */
  P._indexy = function (r, o) {
    const klic = JSON.stringify([o.filtry || {}, o.hledat || '', o.razeni || []]);
    if (r.cache && r.cache.klic === klic) return r.cache.ix;
    let ix = J.filtrujIndexy(r.radky, o.filtry, o.hledat);
    ix = J.seradIndexy(r.radky, ix, o.razeni);
    r.cache = { klic, ix };
    return ix;
  };
  P.stranka = function (o) {
    const r = this.vysledky.get(o.id);
    if (!r) throw new Error('Výsledek už není v paměti – spusťte dotaz znovu.');
    const ix = this._indexy(r, o);
    const off = Math.max(0, o.offset | 0), lim = Math.max(1, o.limit | 0 || 100);
    const vyber = ix.slice(off, off + lim);
    return { radky: vyber.map(i => r.radky[i].map(v => J.proPrenos(v, this.nast.maxText))), indexy: vyber, filtrovano: ix.length, offset: off };
  };
  P.exportVysledku = function (o) {
    const r = this.vysledky.get(o.id);
    if (!r) throw new Error('Výsledek už není v paměti.');
    const radky = this._indexy(r, o).map(i => r.radky[i]);
    return { kusy: o.format === 'json' ? J.naJsonKusy(r.sloupce, radky, o.moznosti) : J.naCsvKusy(r.sloupce, radky, o.moznosti), radku: radky.length, oriznuto: r.oriznuto };
  };
  P.dataGrafu = function (o) {
    const r = this.vysledky.get(o.id);
    if (!r) throw new Error('Výsledek už není v paměti.');
    const radky = this._indexy(r, o).map(i => r.radky[i]);
    const nav = J.navrhniGraf(r.sloupce, radky);
    const nast = Object.assign({ x: nav.x, y: nav.y }, o.graf || {});
    return Object.assign(J.pripravGraf(r.sloupce, radky, nast), { navrh: nav, sloupce: r.sloupce });
  };

  /** Export celé tabulky / pohledu proudově (bez limitu řádků). */
  P.exportTabulky = function ({ tabulka, format, moznosti, filtry, hledat, razeni }) {
    const t = this._tabulka(tabulka);
    const sloupce = t.sloupce.filter(s => !s.skryty).map(s => s.nazev);
    const d = J.sestavDotazProhlizeni({ tabulka, sloupce, klic: null, filtry, hledat, razeni, limit: 1, offset: 0 });
    const sql = d.sql.replace(/ LIMIT 1 OFFSET 0$/, '');
    const st = this._db().prepare(sql);
    const kusy = []; let davka = [], n = 0;
    const json = format === 'json';
    const klice = json ? J.jsonKlice(sloupce) : null;
    if (json) kusy.push('[');
    const zapis = () => {
      if (!davka.length) return;
      if (json) kusy.push(davka.map((r, i) => ((n - davka.length + i) ? ',' : '') + '\n' + J.jsonObjekt(klice, r)).join(''));
      else kusy.push(J.naCsvKusy(sloupce, davka, Object.assign({}, moznosti, { hlavicka: false, bom: false })).join(''));
      davka = [];
    };
    if (!json) kusy.push(J.naCsvKusy(sloupce, [], moznosti).join(''));
    try {
      st.bind(d.params);
      while (st.step()) {
        davka.push(J.normalizujRadek(st.get(null, { useBigInt: true }))); n++;
        if (davka.length >= 5000) zapis();
      }
      zapis();
    } finally { st.free(); }
    if (json) kusy.push(n ? '\n]\n' : ']\n');
    return { kusy, radku: n };
  };

  /** Výpis celé databáze jako SQL skript. */
  P.dumpSql = function () {
    const kusy = ['-- Výpis SQLite databáze (' + (this.info && this.info.nazev) + ')\nPRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n'];
    const obj = this._objekty("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, rowid");
    for (const o of obj.filter(o => o.type === 'table')) {
      kusy.push(o.sql + ';\n');
      if (/^\s*CREATE\s+VIRTUAL/i.test(o.sql)) continue;
      const st = this._db().prepare('SELECT * FROM ' + q(o.name));
      try {
        let buf = '';
        const sl = st.getColumnNames();
        while (st.step()) {
          const r = J.normalizujRadek(st.get(null, { useBigInt: true }));
          buf += 'INSERT INTO ' + q(o.name) + ' (' + sl.map(q).join(',') + ') VALUES(' + r.map(J.lit).join(',') + ');\n';
          if (buf.length > 1 << 20) { kusy.push(buf); buf = ''; }
        }
        if (buf) kusy.push(buf);
      } finally { st.free(); }
    }
    // sqlite_sequence (AUTOINCREMENT)
    try {
      const sekv = this._vse('SELECT name, seq FROM sqlite_sequence').radky;
      if (sekv.length) { kusy.push('DELETE FROM sqlite_sequence;\n'); for (const r of sekv) kusy.push('INSERT INTO sqlite_sequence VALUES(' + J.lit(r[0]) + ',' + J.lit(r[1]) + ');\n'); }
    } catch (e) { /* tabulka neexistuje */ }
    // statistiky ANALYZE (tabulku sqlite_stat1 vytvoří „ANALYZE sqlite_schema")
    try {
      const st1 = this._vse('SELECT tbl, idx, stat FROM sqlite_stat1').radky;
      if (st1.length) {
        kusy.push('ANALYZE sqlite_schema;\n');
        for (const r of st1) kusy.push('INSERT INTO sqlite_stat1 VALUES(' + r.map(J.lit).join(',') + ');\n');
      }
    } catch (e) { /* bez ANALYZE */ }
    for (const o of obj.filter(o => o.type !== 'table')) kusy.push(o.sql + ';\n');
    kusy.push('COMMIT;\n');
    return { kusy };
  };

  // ---------- plán dotazu, statistiky ----------
  P.plan = function ({ sql }) {
    const p = J.rozdelPrikazy(sql);
    if (!p.length) throw new Error('Žádný příkaz.');
    const prikaz = p[0].sql;
    if (/^\s*EXPLAIN\b/i.test(prikaz)) throw new Error('Příkaz už začíná EXPLAIN.');
    const v = this._vse('EXPLAIN QUERY PLAN ' + prikaz);
    let opkody = null;
    try { opkody = this._vse('EXPLAIN ' + prikaz); } catch (e) { /* nic */ }
    return { prikaz, radky: v.radky, strom: J.stromPlanu(v.radky), opkody: opkody ? { sloupce: opkody.sloupce, radky: opkody.radky.slice(0, 2000), celkem: opkody.radky.length } : null, dalsich: p.length - 1 };
  };

  P.statistiky = function () {
    const pr = n => { try { return this._jedna('PRAGMA ' + n); } catch (e) { return null; } };
    let volby = [];
    try { volby = this._vse('SELECT compile_options FROM pragma_compile_options').radky.map(r => r[0]); } catch (e) { /* nic */ }
    let dbstat = false;
    try { this._jedna('SELECT count(*) FROM dbstat LIMIT 1'); dbstat = true; } catch (e) { /* není v buildu */ }
    return {
      velikostStranky: pr('page_size'), pocetStranek: pr('page_count'), freelist: pr('freelist_count'), kodovani: pr('encoding'),
      userVersion: pr('user_version'), applicationId: pr('application_id'), journal: pr('journal_mode'), autoVacuum: pr('auto_vacuum'),
      verzeSchematu: pr('schema_version'), ciziKlice: pr('foreign_keys'), verzeSqlite: this._jedna('SELECT sqlite_version()'),
      volby, dbstat, info: this.info, stav: this.stav()
    };
  };

  /** Velikosti objektů: dbstat, jinak vlastní průchod B-stromy nad aktuálním obrazem databáze. */
  P.velikosti = function () {
    const obj = this._objekty("SELECT type AS typ, name AS nazev, tbl_name AS tabulka, rootpage AS root FROM sqlite_schema WHERE rootpage > 0");
    let dbstat = false;
    try { this._jedna('SELECT count(*) FROM dbstat LIMIT 1'); dbstat = true; } catch (e) { /* nic */ }
    if (dbstat) {
      const r = this._objekty('SELECT name AS nazev, count(*) AS stranky, sum(pgsize) AS bajty, sum(unused) AS nevyuzito, sum(ncell) AS bunky, sum(payload) AS payload FROM dbstat GROUP BY name');
      return { metoda: 'dbstat', objekty: r };
    }
    if (this.vTransakci()) throw new Error('Velikosti se počítají z obrazu souboru – nejdřív potvrďte nebo vraťte otevřenou transakci.');
    const obraz = this.exportDb().data;
    const vys = J.spocitejStranky(obraz, [{ nazev: 'sqlite_schema', typ: 'table', root: 1 }].concat(obj.map(o => ({ nazev: o.nazev, typ: o.typ, root: o.root, tabulka: o.tabulka }))));
    vys.objekty.forEach(o => { const z = obj.find(x => x.nazev === o.nazev); o.tabulka = z ? z.tabulka : o.nazev; });
    return Object.assign({ metoda: 'btree', velikostSouboru: obraz.length }, vys);
  };

  P.statistikaSloupcu = function ({ tabulka }) {
    const t = this._tabulka(tabulka);
    const out = [];
    const celkem = Number(this._jedna('SELECT count(*) FROM ' + q(tabulka)));
    for (const s of t.sloupce.filter(x => !x.skryty)) {
      const c = q(s.nazev), T = q(tabulka);
      const r = this._vse('SELECT count(' + c + '), count(DISTINCT ' + c + '), min(' + c + '), max(' + c + '), ' +
        "avg(CASE WHEN typeof(" + c + ") IN ('integer','real') THEN " + c + ' END), ' +
        "sum(typeof(" + c + ")='integer'), sum(typeof(" + c + ")='real'), sum(typeof(" + c + ")='text'), sum(typeof(" + c + ")='blob'), " +
        'avg(length(' + c + ')), max(length(' + c + ')) FROM ' + T).radky[0];
      const top = this._vse('SELECT ' + c + ', count(*) AS n FROM ' + T + ' GROUP BY 1 ORDER BY n DESC LIMIT 5').radky;
      out.push({
        nazev: s.nazev, typ: s.typ, celkem, nenull: r[0], null: celkem - r[0], ruznych: r[1],
        min: J.proPrenos(r[2], 80), max: J.proPrenos(r[3], 80), prumer: r[4],
        typy: { integer: r[5] || 0, real: r[6] || 0, text: r[7] || 0, blob: r[8] || 0 },
        prumDelka: r[9], maxDelka: r[10], nejcastejsi: top.map(x => [J.proPrenos(x[0], 60), x[1]])
      });
    }
    return { tabulka, celkem, sloupce: out };
  };

  P.kontrola = function ({ typ }) {
    if (typ === 'fk') return this._vse('SELECT "table" AS tabulka, rowid, parent AS rodic, fkid FROM pragma_foreign_key_check');
    if (typ === 'integrity') return this._vse('PRAGMA integrity_check(200)');
    return this._vse('PRAGMA quick_check(200)');
  };

  // ---------- export databáze ----------
  /**
   * Vrací NOVOU kopii obrazu databáze. sql.js při exportu zavře a znovu otevře spojení,
   * proto se nesmí exportovat uprostřed transakce (rozpracované změny by se zahodily).
   */
  P.exportDb = function () {
    const db = this._db();
    if (this.vTransakci()) throw new Error('Je otevřená transakce – nejdřív ji potvrďte (COMMIT) nebo vraťte (ROLLBACK).');
    const data = db.export();
    this._pragmaSpojeni();
    return { data, nazev: this.info ? this.info.nazev : 'databaze.sqlite' };
  };

  P.zavri = function () {
    if (this.db) try { this.db.close(); } catch (e) { /* nic */ }
    this.db = null; this.info = null; this.vysledky.clear();
    return { zavreno: true };
  };

  /** Jednotný vstup pro zprávy z UI. */
  P.zpracuj = function (typ, data) {
    const povolene = ['otevri', 'nova', 'demo', 'schema', 'pocty', 'prohlizej', 'hodnota', 'upravBunku', 'vlozRadek', 'smazRadky', 'zpet',
      'stav', 'commit', 'rollback', 'nastav', 'dotaz', 'stranka', 'exportVysledku', 'dataGrafu', 'exportTabulky', 'dumpSql', 'plan',
      'statistiky', 'velikosti', 'statistikaSloupcu', 'kontrola', 'exportDb', 'zavri'];
    if (!povolene.includes(typ)) throw new Error('Neznámý požadavek: ' + typ);
    return this[typ](data || {});
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Sluzba, VYCHOZI };
  else self.SqlSluzba = Sluzba;
})();
