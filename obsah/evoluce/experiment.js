/* evoluce/experiment.js – fronta dávkových replik: pool Web Workerů, záložně hlavní vlákno po dávkách.
   Přes file:// prohlížeč Worker nepovolí – pak se počítá v hlavním vlákně (pomaleji, ale stejně). */
(function () {
  'use strict';
  const J = window.EvoJadro;

  /**
   * ulohy: [{id, nastaveni, delka, zaznam}]
   * h: {prubeh(id, tick, n), hotovo(id, vysledek), chyba(id, zprava), konec(zruseno)}
   * → {zrus(), vlaken, rezim: 'worker'|'hlavni'}
   */
  function spust(ulohy, h) {
    const fronta = ulohy.slice();
    let bezi = 0, zruseno = false, skonceno = false;
    const workery = [];
    const vlaken = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1, ulohy.length));
    let rezim = 'worker';

    function dokonci() {
      if (skonceno || bezi > 0 || (fronta.length && !zruseno)) return;
      skonceno = true;
      workery.forEach(w => w.terminate());
      h.konec(zruseno);
    }

    /* --- hlavní vlákno: jedna replika naráz, dávky ~25 ms --- */
    let hlavniBezi = false;
    function hlavni() {
      if (hlavniBezi) return;
      hlavniBezi = true;
      (function dalsi() {
        if (zruseno || !fronta.length) { hlavniBezi = false; dokonci(); return; }
        const u = fronta.shift(); bezi++;
        let r;
        try { r = new J.Replikace(u.nastaveni, u.delka, u.zaznam); }
        catch (e) { bezi--; h.chyba(u.id, e.message); setTimeout(dalsi, 0); return; }
        (function davka() {
          if (zruseno) { bezi--; hlavniBezi = false; dokonci(); return; }
          const konec = performance.now() + 25;
          let hot = false;
          while (!hot && performance.now() < konec) hot = r.dal(20);
          if (hot) { bezi--; h.hotovo(u.id, r.vysledek()); setTimeout(dalsi, 0); }
          else { h.prubeh(u.id, r.stav.tick, r.stav.orgs.length); setTimeout(davka, 0); }
        })();
      })();
    }
    function prepniNaHlavni(vratit) {
      if (vratit) fronta.unshift(vratit);
      rezim = 'hlavni';
      workery.forEach(w => w.terminate());
      workery.length = 0;
      hlavni();
    }

    /* --- workery --- */
    function zamestnej(w) {
      if (zruseno || !fronta.length) { w.volny = true; dokonci(); return; }
      const u = fronta.shift();
      w.uloha = u; w.volny = false; bezi++;
      w.postMessage(u);
    }
    try {
      if (typeof Worker === 'undefined' || location.protocol === 'file:') throw new Error('bez workerů');
      for (let i = 0; i < vlaken; i++) {
        const w = new Worker('evoluce/worker.js');
        w.onmessage = e => {
          const m = e.data;
          w.ozval = true;
          if (m.typ === 'prubeh') { if (!zruseno) h.prubeh(m.id, m.tick, m.n); return; }
          bezi--; w.uloha = null;
          if (!zruseno) { if (m.typ === 'hotovo') h.hotovo(m.id, m.vysledek); else h.chyba(m.id, m.zprava); }
          zamestnej(w);
        };
        w.onerror = ev => {
          ev.preventDefault();
          if (rezim !== 'worker') return;
          // worker se nenačetl (CSP, file://…) → dopočítat v hlavním vlákně
          const u = w.uloha; if (u) bezi--;
          const vratit = workery.filter(x => x !== w && x.uloha).map(x => { bezi--; return x.uloha; });
          vratit.forEach(x => fronta.unshift(x));
          prepniNaHlavni(u);
        };
        workery.push(w);
      }
      workery.forEach(zamestnej);
    } catch (e) {
      prepniNaHlavni(null);
    }

    return {
      zrus() { zruseno = true; fronta.length = 0; workery.forEach(w => w.terminate()); bezi = 0; dokonci(); },
      get rezim() { return rezim; },
      vlaken: rezim === 'worker' ? vlaken : 1,
    };
  }

  window.EvoExperiment = { spust };
})();
