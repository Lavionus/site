/* Web Worker: databáze SQLite (sql.js / WebAssembly) mimo hlavní vlákno.
   Protokol: {id, typ, data} → {id, ok:true, vysledek} | {id, ok:false, chyba}.
   Velká data (export DB, CSV/JSON) se vrací jako Blob / přenositelný buffer. */
/* global initSqlJs, SqlSluzba */
importScripts('../lib/sqljs/sql-wasm.js', 'jadro.js', 'sluzba.js');

let sluzba = null;
const pripraveno = initSqlJs({ locateFile: f => '../lib/sqljs/' + f })
  .then(SQL => { sluzba = new SqlSluzba(SQL); return true; });

pripraveno.then(() => postMessage({ id: 0, ok: true, vysledek: { pripraveno: true } }),
  e => postMessage({ id: 0, ok: false, chyba: 'Nepodařilo se načíst SQLite (WebAssembly): ' + (e && e.message || e) }));

self.onmessage = async (ev) => {
  const { id, typ, data } = ev.data || {};
  try {
    await pripraveno;
    const t0 = performance.now();
    let v = sluzba.zpracuj(typ, data);
    const prenos = [];
    if (v && v.kusy) {
      const mime = data && data.format === 'json' ? 'application/json' : (typ === 'dumpSql' ? 'application/sql' : 'text/csv');
      v = Object.assign({}, v, { blob: new Blob(v.kusy, { type: mime + ';charset=utf-8' }) });
      delete v.kusy;
    }
    if (typ === 'exportDb') prenos.push(v.data.buffer);
    else if (typ === 'hodnota' && v instanceof Uint8Array) { v = v.slice(); prenos.push(v.buffer); } // kopie – uložený výsledek zůstane
    postMessage({ id, ok: true, vysledek: v, cas: performance.now() - t0 }, prenos);
  } catch (e) {
    postMessage({ id, ok: false, chyba: String(e && e.message || e) });
  }
};
