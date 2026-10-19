/* Generátor testovacích dat – Web Worker (generování po dávkách, náhled, export do Blobu).
 * Stejný soubor slouží i jako záložní obsluha v hlavním vlákně (např. při otevření ze souboru),
 * kde se načte obyčejným <script> a použije přes TDPracovnik.vytvorObsluhu(posli). */
(function (koren) {
  'use strict';
  const vWorkeru = typeof WorkerGlobalScope !== 'undefined' && koren instanceof WorkerGlobalScope;
  if (vWorkeru) importScripts('slovniky.js', 'jadro.js');

  function vytvorObsluhu(posli) {
    const J = koren.TDJadro;
    let gen = null;          // dokončený generátor (data pro náhled a export)
    let zrusit = 0;          // id úlohy, kterou je třeba zrušit
    const cekej = () => new Promise(r => setTimeout(r, 0));

    async function generuj(z) {
      const id = z.id; gen = null;
      let g;
      try { g = new J.Generator(z.schema, { seed: z.seed }); }
      catch (e) { posli({ typ: 'chyba', id, zprava: e.message, chyby: e.chyby || null }); return; }
      const t0 = Date.now(); let radku = 0, posledni = 0;
      try {
        while (!g.hotovo) {
          if (zrusit === id) { posli({ typ: 'zruseno', id }); return; }
          const pr = g.krok(z.davka || 5000);
          radku = 0; for (const n in g.data) radku += g.data[n].radky.length;
          const ted = Date.now();
          if (ted - posledni > 60 || g.hotovo) { posli(Object.assign({ typ: 'prubeh', id, radku, cas: ted - t0 }, pr)); posledni = ted; }
          await cekej();
        }
      } catch (e) {
        posli({ typ: 'chyba', id, zprava: e.message, info: e.info || null }); return;
      }
      const tGen = Date.now() - t0;
      const statistiky = {};
      for (const n of g.poradi) statistiky[n] = J.statistikyTabulky(g.data[n]);
      const integrita = J.kontrolaIntegrity(g.data, g.schema);
      gen = g;
      posli({
        typ: 'hotovo', id, cas: tGen, casCelkem: Date.now() - t0, radku,
        tabulky: g.poradi.map(n => ({ nazev: n, sloupce: g.data[n].sloupce, druhy: g.data[n].druhy, pocet: g.data[n].radky.length })),
        statistiky, integrita,
      });
    }

    async function exportuj(z) {
      const id = z.id;
      if (!gen) { posli({ typ: 'chyba', id, zprava: 'Nejsou vygenerovaná data – nejdřív spusťte generování.' }); return; }
      const casti = []; let velikost = 0; let posledni = 0;
      try {
        for (const k of J.exportuj(gen.data, gen.schema, z.moznosti)) {
          if (zrusit === id) { posli({ typ: 'zruseno', id }); return; }
          if (k.text) { const b = new Blob([k.text]); casti.push(b); velikost += b.size; }
          const ted = Date.now();
          if (ted - posledni > 80) { posli({ typ: 'export_prubeh', id, hotovo: k.hotovo, celkem: k.celkem, velikost }); posledni = ted; await cekej(); }
        }
      } catch (e) { posli({ typ: 'chyba', id, zprava: e.message }); return; }
      const blob = new Blob(casti, { type: z.mime || 'text/plain;charset=utf-8' });
      posli({ typ: 'export_hotovo', id, blob, velikost: blob.size });
    }

    return function prijmi(z) {
      if (!z || !z.typ) return;
      if (z.typ === 'generuj') return generuj(z);
      if (z.typ === 'zrus') { zrusit = z.id; return; }
      if (z.typ === 'export') return exportuj(z);
      if (z.typ === 'radky') {
        const d = gen && gen.data[z.tabulka];
        if (!d) { posli({ typ: 'radky', id: z.id, tabulka: z.tabulka, od: 0, radky: [], celkem: 0 }); return; }
        const od = Math.max(0, Math.min(z.od | 0, Math.max(0, d.radky.length - 1)));
        posli({ typ: 'radky', id: z.id, tabulka: z.tabulka, od, radky: d.radky.slice(od, od + (z.pocet || 50)), celkem: d.radky.length });
        return;
      }
      if (z.typ === 'zahod') { gen = null; return; }
    };
  }

  koren.TDPracovnik = { vytvorObsluhu };
  if (vWorkeru) {
    const prijmi = vytvorObsluhu(z => koren.postMessage(z));
    koren.onmessage = e => prijmi(e.data);
  }
})(typeof self !== 'undefined' ? self : this);
