/* evoluce/worker.js – běh jedné repliky dávkového experimentu mimo hlavní vlákno. */
'use strict';
importScripts('jadro.js');
self.onmessage = e => {
  const u = e.data;
  try {
    const r = new self.EvoJadro.Replikace(u.nastaveni, u.delka, u.zaznam);
    let posl = Date.now();
    while (!r.dal(50)) {
      const ted = Date.now();
      if (ted - posl > 250) { posl = ted; self.postMessage({ id: u.id, typ: 'prubeh', tick: r.stav.tick, n: r.stav.orgs.length }); }
    }
    self.postMessage({ id: u.id, typ: 'hotovo', vysledek: r.vysledek() });
  } catch (err) {
    self.postMessage({ id: u.id, typ: 'chyba', zprava: String(err && err.message || err) });
  }
};
