/* Modelář 3D – výpočty booleanů z hlavního vlákna.
   M.spocitejSkupinu(uzel) → Promise s daty pro zobrazení. Stejné klíče se
   slučují (jeden výpočet pro více požadavků). Počítá worker; když nejde
   spustit nebo spadne, počítá se v hlavním vlákně (manifold přes import()).
   Událost 'vypocty' nese počet rozpracovaných výpočtů (stavový řádek). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  M.vytvorVypocty = function () {
    let worker = null, dalsiId = 0, zaloha = null, pozadavku = 0;
    const cekajici = new Map();      // id → {resolve, reject, uzel}
    const podleKlice = new Map();    // klíč → Promise
    const poslaneZdroje = new Set(); // id zdrojů, které už worker má

    function hlasStav() { M.vysli('vypocty', podleKlice.size); }

    /** Načte obyčejný skript (funguje i z file://, na rozdíl od import()). */
    function nactiSkript(src) {
      return new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = resolve;
        el.onerror = () => reject(new Error('nejde načíst ' + src));
        document.head.appendChild(el);
      });
    }

    /** Výpočet v hlavním vlákně (bez workeru). Na file:// prohlížeč nedovolí
        stáhnout .wasm, proto se vezme z base64 v manifold.wasm.js. */
    async function vHlavnimVlakne(uzel, typ = 'skupina') {
      if (!zaloha) zaloha = (async () => {
        // knihovna si z vlastní adresy skládá cestu k .wasm (dřív import.meta.url)
        globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
        if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
        let volby;
        if (location.protocol === 'file:') {
          await nactiSkript('lib/manifold/manifold.wasm.js');
          const b64 = globalThis.MANIFOLD_WASM_B64;
          const bin = new Uint8Array(b64.length * 3 / 4 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0));
          const s = atob(b64);
          for (let i = 0; i < bin.length; i++) bin[i] = s.charCodeAt(i);
          delete globalThis.MANIFOLD_WASM_B64;
          volby = { wasmBinary: bin };
        } else volby = { locateFile: f => new URL('lib/manifold/' + f, location.href).href };
        const w = await globalThis.ManifoldModule(volby);
        w.setup();
        return M.vytvorBooleany(w, 32);
      })();
      zaloha.catch(() => { zaloha = null; });          // příště zkusit znovu
      const B = await zaloha;
      try { return vypocet(B, uzel, typ); }
      catch (e) {
        // pád WebAssembly v hlavním vlákně: modul zahodit, příští výpočet založí nový
        if (padWasm(e && e.message)) { zaloha = null; throw new Error(CHYBA_PAMETI); }
        throw e;
      }
    }
    function vypocet(B, uzel, typ) {
      if (typ === 'barvy') return { casti: B.vysledekPodleBarev(uzel).map(c => ({ barva: c.barva, poz: c.sit.poz, idx: c.sit.idx, objem: c.objem })) };
      const r = B.vysledekSkupiny(uzel);
      if (typ === 'sit') return { poz: r.sit.poz, idx: r.sit.idx, barvyTroj: r.barvyTroj, paleta: r.paleta, objem: r.objem };
      const z = M.zobrazovaciData(r.sit, 30, uzel.barevne ? r.barvyTroj : null, r.paleta);
      return Object.assign(z, { trojuhelniku: r.sit.idx.length / 3, objem: r.objem });
    }

    function prepniNaZalohu(duvod) {
      if (!worker) return;
      console.warn('Modelář: worker nejde použít (' + duvod + '), počítám v hlavním vlákně.');
      try { worker.terminate(); } catch (e) { /* už neběží */ }
      worker = null;
      for (const [id, c] of cekajici) (c.zaloha ? Promise.resolve().then(c.zaloha) : vHlavnimVlakne(c.uzel, c.typ)).then(c.resolve, c.reject);
      cekajici.clear();
    }

    /** Pád WebAssembly (došla paměť, poškozený stav): modul je pak nepoužitelný pro všechny další výpočty. */
    const padWasm = t => /out of bounds|unreachable|memory|table index|unknown type|RuntimeError|Aborted|abort\(|function signature|null function|indirect call|divide by zero|integer overflow|stack overflow/i.test(String(t || ''));
    const CHYBA_PAMETI = 'výpočet se nevešel do paměti – zmenši model nebo díl (méně segmentů, závitů, trojúhelníků)';

    function zalozWorker() {
      try {
        worker = new Worker('modelar/worker.js');            // vůči stránce obsah/modelar.html
        worker.onmessage = e => {
          const c = cekajici.get(e.data.id);
          if (!c) return;
          // worker se nerozběhl (manifold nejde načíst): všechno rozdělané i další spočítá hlavní vlákno
          if (e.data.start) { prepniNaZalohu(e.data.chyba); return; }
          cekajici.delete(e.data.id);
          if (e.data.ok) { c.resolve(e.data); return; }
          if (padWasm(e.data.chyba)) {
            // tenhle výpočet ohlásit, worker vyměnit za čerstvý a rozdělané poslat znovu
            c.reject(new Error(CHYBA_PAMETI));
            restartujWorker(e.data.chyba);
            return;
          }
          c.reject(new Error(e.data.chyba));
        };
        worker.onerror = e => { e.preventDefault(); prepniNaZalohu(e.message || 'chyba workeru'); };
      } catch (e) { worker = null; }
    }
    function restartujWorker(duvod) {
      console.warn('Modelář: worker výpočtů spadl (' + duvod + '), spouštím nový.');
      try { worker.terminate(); } catch (e) { /* už neběží */ }
      poslaneZdroje.clear();                              // nový worker nemá nic
      zalozWorker();
      if (!worker) { prepniNaZalohu('restart'); return; }
      for (const c of cekajici.values()) { try { c.odeslat(); } catch (e) { c.reject(e); } }
    }
    zalozWorker();

    /** Geometrie importovaných modelů ve skupině (i sítě přesných úprav), které worker ještě nemá. */
    function chybejiciZdroje(uzel) {
      const out = {};
      for (const id of M.zdrojeUzlu([uzel], new Set(), true)) if (!poslaneZdroje.has(id)) {
        const z = M.sitZdroje(id);
        out[id] = { poz: z.poz, idx: z.idx };
      }
      return out;
    }
    /** Zdroje se označí jako odeslané až po úspěšném odeslání zprávy. */
    function poslano(zdroje) { for (const id of Object.keys(zdroje)) poslaneZdroje.add(id); }

    /** Po otevření jiného projektu: zapomenout geometrie, které nepotřebuje dokument, jeho historie ani schránka
        (v hlavním vlákně i ve workerech). Importované modely zůstávají uložené v IndexedDB. */
    M.uklidZdroje = function () {
      const potreba = new Set();
      for (const z of M.historie.zaznamy) M.zdrojeUzlu(z.dok.uzly, potreba, true);
      M.zdrojeUzlu(M.app.dok.uzly, potreba, true);
      if (M.app.schranka) M.zdrojeUzlu(M.app.schranka.uzly, potreba, true);
      const pryc = [...M.zdroje.keys()].filter(k => !potreba.has(k));
      if (!pryc.length) return 0;
      for (const k of pryc) { M.zdroje.delete(k); poslaneZdroje.delete(k); occtPoslane.delete(k); }
      try { if (worker) worker.postMessage({ typ: 'zapomen', ids: pryc }); } catch (e) { /* worker už neběží */ }
      try { if (occtWorker) occtWorker.postMessage({ typ: 'zapomen', ids: pryc }); } catch (e) { /* worker už neběží */ }
      return pryc.length;
    };

    /** Odvozené sítě přesných úprav (OCCT) se hromadí s každou zkoušenou hodnotou zaoblení.
        Nad limit se zapomenou ty, které aktuální dokument nepotřebuje (při Zpět se spočítají znovu). */
    const MAX_ODVOZENYCH = 40;
    function uklidOdvozene() {
      const odvozene = [...M.zdroje].filter(([, z]) => z.odvozeny).map(([k]) => k);
      if (odvozene.length <= MAX_ODVOZENYCH) return;
      const potreba = M.app && M.app.dok ? M.zdrojeUzlu(M.app.dok.uzly, new Set(), true) : new Set();
      const pryc = odvozene.filter(k => !potreba.has(k)).slice(0, odvozene.length - MAX_ODVOZENYCH);
      if (!pryc.length) return;
      for (const k of pryc) { M.zdroje.delete(k); poslaneZdroje.delete(k); occtPoslane.delete(k); }
      try { if (worker) worker.postMessage({ typ: 'zapomen', ids: pryc }); } catch (e) { /* worker už neběží */ }
      try { if (occtWorker) occtWorker.postMessage({ typ: 'zapomen', ids: pryc }); } catch (e) { /* worker už neběží */ }
    }

    // ------------------------------------------------------------ přesné jádro (OpenCascade)
    // Načte se až při první potřebě (22 MB). Vlastní worker; z file:// v hlavním vlákně
    // s WASM rozbaleným z gzip+base64.
    let occtWorker = null, occtZaloha = null, occtStav = 'nenacteno';
    const occtCekajici = new Map();
    const occtPoslane = new Set();

    async function occtVHlavnimVlakne() {
      if (!occtZaloha) occtZaloha = (async () => {
        globalThis.OCCT_URL = new URL('lib/occt/occt.klasicky.js', location.href).href;
        if (!globalThis.OcctWasmModule) await nactiSkript('lib/occt/occt.klasicky.js');
        const volby = { print: () => {}, printErr: () => {} };
        if (location.protocol === 'file:') {
          await nactiSkript('lib/occt/occt-wasm.wasm.gz.js');
          const s = atob(globalThis.OCCT_WASM_GZ_B64);
          delete globalThis.OCCT_WASM_GZ_B64;
          const gz = new Uint8Array(s.length);
          for (let i = 0; i < s.length; i++) gz[i] = s.charCodeAt(i);
          volby.wasmBinary = new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
        } else volby.locateFile = f => new URL('lib/occt/' + f, location.href).href;
        return M.vytvorOcct(await globalThis.OcctWasmModule(volby));
      })();
      occtZaloha.catch(() => { occtZaloha = null; });
      return occtZaloha;
    }
    function occtMistni(z) {
      // spadlé jádro (WebAssembly „out of memory“ apod.) má rozbitou paměť: zahodit, příště se načte znovu
      const pad = e => { if (padWasm(String(e && e.message || e))) { occtZaloha = null; occtStav = 'nenacteno'; throw new Error(CHYBA_PAMETI); } throw e; };
      return occtVHlavnimVlakne().then(O => {
        // hlavní vlákno registr zdrojů už má (celé záznamy i s barvami) – nepřepisovat ořezanými kopiemi
        if (z.zdroje) for (const [k, v] of Object.entries(z.zdroje)) if (!M.zdroje.has(k)) M.zdroje.set(k, v);
        if (z.typ === 'sit') return O.sitUzlu(z.uzel, z.site);
        if (z.typ === 'hrany') return O.hrany(z.uzel, z.site);
        if (z.typ === 'plochy') return O.plochy(z.uzel, z.site);
        if (z.typ === 'step') return O.step(z.polozky);
        if (z.typ === 'importStep') return O.importStep(z.text);
        throw new Error('neznámý požadavek ' + z.typ);
      }).catch(pad);
    }
    function occtNaZalohu(duvod) {
      if (!occtWorker) return;
      console.warn('Modelář: worker přesného jádra nejde použít (' + duvod + '), počítám v hlavním vlákně.');
      try { occtWorker.terminate(); } catch (e) { /* už neběží */ }
      occtWorker = false;
      for (const c of occtCekajici.values()) occtMistni(c.zprava).then(c.resolve, c.reject);
      occtCekajici.clear();
    }
    function spustOcctWorker() {
      if (occtWorker !== null) return;
      occtWorker = false;
      if (location.protocol === 'file:') return;      // worker z file:// prohlížeč nespustí
      try {
        occtWorker = new Worker('modelar/worker_occt.js');
        occtWorker.onmessage = e => {
          const c = occtCekajici.get(e.data.id);
          if (!c) return;
          if (e.data.start) { occtNaZalohu(e.data.chyba); return; }
          occtCekajici.delete(e.data.id);
          if (e.data.ok) { c.resolve(e.data.vysledek); return; }
          if (padWasm(e.data.chyba)) {
            // přesné jádro spadlo: tenhle a rozdělané výpočty ohlásit, příští požadavek založí nový worker
            c.reject(new Error(CHYBA_PAMETI));
            try { occtWorker.terminate(); } catch (x) { /* už neběží */ }
            occtWorker = null; occtPoslane.clear();
            occtStav = 'nenacteno';                 // nový worker se bude načítat znovu (ukázat průběh)
            for (const d of occtCekajici.values()) d.reject(new Error(CHYBA_PAMETI));
            occtCekajici.clear();
            return;
          }
          c.reject(new Error(e.data.chyba));
        };
        occtWorker.onerror = e => { e.preventDefault(); occtNaZalohu(e.message || 'chyba workeru'); };
      } catch (e) { occtWorker = false; }
    }
    /** Požadavek na přesné jádro; zdroje = id importovaných modelů, které potřebuje. */
    function occt(zprava, idZdroju = []) {
      spustOcctWorker();
      if (occtStav === 'nenacteno') { occtStav = 'nacita'; M.vysli('occt', 'nacita'); }
      const zdroje = {};
      for (const id of idZdroju) if (!occtPoslane.has(id) && M.zdroje.has(id)) {
        const z = M.zdroje.get(id);
        zdroje[id] = z.step ? { poz: z.poz, idx: z.idx, step: z.step, stredStep: z.stredStep } : { poz: z.poz, idx: z.idx };
      }
      const p = new Promise((resolve, reject) => {
        const z = Object.assign({ zdroje }, zprava);
        if (occtWorker) {
          const id = ++dalsiId;
          occtCekajici.set(id, { resolve, reject, zprava: z });
          try { occtWorker.postMessage(Object.assign({ id }, z)); for (const k of Object.keys(zdroje)) occtPoslane.add(k); }
          catch (e) { occtCekajici.delete(id); reject(e); }
        } else occtMistni(z).then(resolve, reject);
      });
      const hotovo = () => { if (occtStav !== 'pripraveno') { occtStav = 'pripraveno'; M.vysli('occt', 'pripraveno'); } };
      p.then(hotovo, hotovo);
      return p;
    }

    /** Sítě uzlů, které OCCT samo nepostaví (skici, díly) – spočítá je manifold. */
    async function sitePro(u, site = {}) {
      if (u.druh === 'skupina') { for (const d of u.deti) await sitePro(d, site); return site; }
      if (M.maPrirozene(u)) {
        const klic = M.klicGeometrie(u);
        if (!site[klic]) { const r = await pozadej(u, 'sit'); site[klic] = { poz: r.poz, idx: r.idx }; }
      }
      return site;
    }
    const zdrojeOcct = u => [...M.zdrojeUzlu([u])];

    /** Dopočítá sítě skupin s přesnou úpravou (nejhlubší první) do registru zdrojů. */
    const pripravuje = new Map();
    function pripravOcct(uzel) {
      const chybi = M.chybejiciOcct(uzel);
      if (!chybi.length) return Promise.resolve();
      return chybi.reduce((p, g) => p.then(() => {
        const klic = M.klicOcct(g);
        if (M.zdroje.has(klic)) return;
        if (!pripravuje.has(klic)) {
          const q = sitePro(g).then(site => occt({ typ: 'sit', uzel: g, site }, zdrojeOcct(g))).then(r => {
            M.zdroje.set(klic, { poz: r.poz, idx: r.idx, objem: r.objem, odvozeny: true });
            uklidOdvozene();
          });
          pripravuje.set(klic, q);
          const pryc = () => pripravuje.delete(klic);
          q.then(pryc, pryc);
        }
        return pripravuje.get(klic);
      }), Promise.resolve());
    }

    /** Hrany a rovinné plochy pro výběr (uzel = rámec úpravy z M.obalUpravou). */
    M.occtHrany = async uzel => occt({ typ: 'hrany', uzel, site: await sitePro(uzel) }, zdrojeOcct(uzel));
    M.occtPlochy = async uzel => occt({ typ: 'plochy', uzel, site: await sitePro(uzel) }, zdrojeOcct(uzel));
    /** Ověří úpravu přesným jádrem (vyhodí českou chybu) a uloží síť do registru. */
    M.occtOver = async uzel => { await pripravOcct(uzel); return M.zdroje.get(M.klicOcct(uzel)); };
    /** STEP z uzlů ve světových souřadnicích. Co OCCT nepostaví přesně (díly, skici),
        jde jako síť z manifoldu. */
    M.occtStep = async uzly => {
      const polozky = [];
      for (const u of uzly) {
        await pripravOcct(u);
        const e = M.maticeUzlu(u).elements;
        const matice = [e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]];
        if (M.maPrirozene(u)) { const r = await pozadej(u, 'sit'); polozky.push({ uzel: u, matice, sit: { poz: r.poz, idx: r.idx } }); }
        else polozky.push({ uzel: u, matice, site: await sitePro(u) });
      }
      return occt({ typ: 'step', polozky }, [...M.zdrojeUzlu(uzly)]);
    };
    M.occtImportStep = text => occt({ typ: 'importStep', text });
    M.occtStav = () => occtStav;

    async function pozadejSOcct(uzel, typ) {
      await pripravOcct(uzel);
      return pozadej(uzel, typ);
    }

    function pozadej(uzel, typ) {
      return new Promise((resolve, reject) => {
        if (worker) {
          const id = ++dalsiId;
          const odeslat = () => { const zdroje = chybejiciZdroje(uzel); worker.postMessage({ id, typ, uzel, zdroje }); poslano(zdroje); };
          try { chybejiciZdroje(uzel); } catch (e) { reject(e); return; }   // chybí geometrie modelu
          cekajici.set(id, { resolve, reject, uzel, typ, odeslat });
          try { odeslat(); }
          catch (e) { cekajici.delete(id); reject(e); }
        } else vHlavnimVlakne(uzel, typ).then(resolve, reject);
      });
    }

    /** Technický výkres (jadro/vykres.js) ve workeru; bez workeru v hlavním vlákně. */
    M.spocitejVykres = function (site, volby) {
      const zaloha = () => M.vykres(site, volby);
      return new Promise((resolve, reject) => {
        if (!worker) { Promise.resolve().then(zaloha).then(resolve, reject); return; }
        const id = ++dalsiId;
        const odeslat = () => worker.postMessage({ id, typ: 'vykres', site, volby });
        cekajici.set(id, { resolve: d => resolve(d.vykres || d), reject, zaloha, odeslat });
        try { odeslat(); }
        catch (e) { cekajici.delete(id); reject(e); }
      });
    };

    /** Indexovaná síť skupiny v přirozených souřadnicích (pro export). */
    M.sitSkupiny = uzel => pozadejSOcct(uzel, 'sit');
    /** Barevná skupina rozdělená na uzavřená tělesa podle barev (přirozené souřadnice). */
    M.castiPodleBarev = uzel => pozadejSOcct(uzel, 'barvy').then(r => r.casti);

    M.spocitejSkupinu = function (uzel) {
      const klic = M.klicVypoctu(uzel);
      if (podleKlice.has(klic)) return podleKlice.get(klic);
      pozadavku++;
      const p = pozadejSOcct(uzel, 'skupina');
      podleKlice.set(klic, p);
      hlasStav();
      const hotovo = () => { podleKlice.delete(klic); hlasStav(); };
      p.then(hotovo, hotovo);
      return p;
    };
    M.pocitaSe = () => podleKlice.size > 0;
    return {
      maWorker: () => !!worker,
      /** Počet skutečně odeslaných výpočtů (sloučené a z mezipaměti se nepočítají). */
      pozadavku: () => pozadavku,
      /** Pro testy: chovat se jako bez workeru. */
      bezWorkeru: () => prepniNaZalohu('test'),
      bezOcctWorkeru: () => { spustOcctWorker(); occtNaZalohu('test'); },
      maOcctWorker: () => !!occtWorker,
    };
  };
})(MDL);
