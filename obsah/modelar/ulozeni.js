/* Modelář 3D – ukládání projektů v prohlížeči (IndexedDB 'webapp_modelar').
   Úložiště 'projekty' (id, nazev, vytvoreno, upraveno, dok, deska, kamera,
   nahled = PNG data URL, pocet) a 'zdroje' (geometrie importovaných modelů,
   každá jen jednou), od verze 2 i 'tvary' (vlastní tvary do knihovny). Projekt se ukládá sám 1,2 s po každé změně a při
   odchodu ze stránky. Naposledy otevřený projekt si pamatuje localStorage.
   Bez IndexedDB (zakázané úložiště) aplikace jede dál, jen neukládá. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const DB = 'webapp_modelar', KLIC_POSLEDNI = 'modelar_posledni';

  function pozadavek(r) {
    return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  }
  function otevriDb() {
    return new Promise((resolve, reject) => {
      let r;
      try { r = indexedDB.open(DB, 2); } catch (e) { reject(e); return; }
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('projekty')) db.createObjectStore('projekty', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('zdroje')) db.createObjectStore('zdroje', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tvary')) db.createObjectStore('tvary', { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('úložiště je zablokované jinou kartou'));
    });
  }

  /** Záznam zdroje geometrie pro IndexedDB (kopie polí, i barvy a STEP). */
  const zaznamZdroje = (id, g) => ({ id, nazev: g.nazev, format: g.format, poz: g.poz.slice().buffer, idx: g.idx.slice().buffer, step: g.step, stredStep: g.stredStep,
    ...(g.barvyTroj && g.paleta ? { barvyTroj: g.barvyTroj.slice().buffer, paleta: g.paleta } : {}) });

  M.vytvorUlozeni = function (S) {
    let db = null, casovac = null, ukladani = Promise.resolve();
    const ulozeneZdroje = new Set();
    const U = { dostupne: false };

    const transakce = (st, rezim = 'readonly') => {
      if (!db) throw new Error('úložiště prohlížeče není k dispozici (aplikace se mezitím aktualizovala – obnov stránku)');
      return db.transaction(st, rezim);
    };

    /** Stav projektu k uložení. */
    function zaznam() {
      const p = M.app.projekt;
      return {
        id: p.id, nazev: p.nazev, vytvoreno: p.vytvoreno, upraveno: Date.now(),
        // rozdělaná úprava (náhled pole, tažení) se neukládá – jen potvrzený stav
        dok: M.app.uprava ? M.app.uprava.zaklad : M.app.dok, deska: { sirka: S.deska.sirka, hloubka: S.deska.hloubka, krok: S.deska.krok },
        kamera: S.kamera.stav(), pocet: (M.app.uprava ? M.app.uprava.zaklad : M.app.dok).uzly.length,
      };
    }

    /** Uloží hned (vrací Promise). Náhled se vykreslí z aktuální scény. */
    // náhled (vykreslení + readPixels) je drahý: nejvýš jednou za 20 s, při odchodu z projektu vždy
    let nahled = { projekt: null, cas: 0, data: '' }, nahledNeuplny = false;
    U.ulozTed = function (vynutitNahled = true) {
      clearTimeout(casovac); casovac = null;
      if (!db || !M.app.projekt) return Promise.resolve(false);
      const z = zaznam();
      const ted = Date.now();
      if (vynutitNahled || nahled.projekt !== z.id || ted - nahled.cas > 20000 || !nahled.data) {
        try { nahled = { projekt: z.id, cas: ted, data: S.vytvorNahled(240, 180) }; } catch (e) { nahled = { projekt: z.id, cas: ted, data: '' }; }
        // tělesa, která worker ještě počítá, v náhledu chybí – po dopočítání se uloží znovu
        nahledNeuplny = !!(S.telesa && S.telesa.info().ceka);
      }
      z.nahled = nahled.data;
      const potreba = [...M.zdrojeUzlu(z.dok.uzly)];
      const nove = potreba.filter(id => !ulozeneZdroje.has(id));
      ukladani = ukladani.then(() => new Promise((resolve, reject) => {
        const t = transakce(['projekty', 'zdroje'], 'readwrite');
        t.objectStore('projekty').put(z);
        const st = t.objectStore('zdroje');
        for (const id of nove) st.put(zaznamZdroje(id, M.sitZdroje(id)));
        // jiná karta mohla smazat projekt a s ním geometrii, kterou tahle (třeba po Zpět) zase používá: doplnit
        const uz = potreba.filter(id => ulozeneZdroje.has(id));
        if (uz.length) {
          const r = st.getAllKeys();
          r.onsuccess = () => { const ma = new Set(r.result); for (const id of uz) if (!ma.has(id) && M.zdroje.has(id)) st.put(zaznamZdroje(id, M.zdroje.get(id))); };
        }
        t.oncomplete = () => {
          nove.forEach(id => ulozeneZdroje.add(id));
          if (M.app.projekt) M.app.projekt.upraveno = z.upraveno;
          M.vysli('ulozeno', z);
          resolve(true);
        };
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('ukládání přerušeno'));
      })).catch(e => { console.error('Modelář: uložení selhalo', e); M.vysli('chybaUlozeni', e); return false; });
      return ukladani;
    };

    /** Naplánuje uložení (debounce 1,2 s). */
    U.naplanuj = function () {
      if (!db) return;
      clearTimeout(casovac);
      casovac = setTimeout(() => U.ulozTed(false), 1200);      // automaticky: náhled jen občas
      M.vysli('neulozeno');
    };

    U.seznam = async function () {
      if (!db) return [];
      const vse = await pozadavek(transakce('projekty').objectStore('projekty').getAll());
      return vse.sort((a, b) => b.upraveno - a.upraveno);
    };

    /** Načte zdroje geometrie do M.zdroje (ty, které chybí). */
    async function nactiZdroje(ids) {
      const st = transakce('zdroje').objectStore('zdroje');
      for (const id of ids) {
        if (M.zdroje.has(id)) { ulozeneZdroje.add(id); continue; }
        const z = await pozadavek(st.get(id));
        if (!z) throw new Error('v úložišti chybí geometrie importovaného modelu');
        M.zdroje.set(id, { poz: new Float32Array(z.poz), idx: new Uint32Array(z.idx), nazev: z.nazev, format: z.format, step: z.step, stredStep: z.stredStep,
          ...(z.barvyTroj && z.paleta ? { barvyTroj: new Uint16Array(z.barvyTroj), paleta: z.paleta } : {}) });
        ulozeneZdroje.add(id);
      }
    }

    /** Přepne aplikaci na data projektu (bez ukládání). */
    function pouzij(p) {
      // projekt z úložiště prohlížeče projde stejnou kontrolou jako ze souboru (starší verze dat se doplní a opraví;
      // poškozený projekt vyhodí českou chybu – volající ji ukáže a nechá otevřený předchozí)
      p = Object.assign({}, p, { dok: M.projekt.overDok(p.dok) });
      M.app.projekt = { id: p.id, nazev: p.nazev, vytvoreno: p.vytvoreno || Date.now(), upraveno: p.upraveno || Date.now() };
      if (p.deska) M.vysli('nastavDesku', p.deska);
      M.otevriDokument(p.dok);
      if (M.uklidZdroje) M.uklidZdroje();          // geometrie předchozího projektu z paměti pryč
      if (p.kamera) { S.kamera.obnov(p.kamera); M.vysli('projekce', S.kamera.ortograficka); }
      else S.domu(0);
      M.nastavRovinu(null);
      try { localStorage.setItem(KLIC_POSLEDNI, p.id); } catch (e) { /* bez úložiště */ }
      M.vysli('projekt', M.app.projekt);
      M.prekresli();
    }

    /** Odchod z otevřeného projektu: uložit, ale nepoužitý prázdný „Projekt N“ (nic v něm, nic se neudělalo)
        rovnou smazat – jinak by každé „Nový projekt“ nechalo v přehledu prázdnou kartu. */
    async function opust() {
      const p = M.app.projekt;
      const prazdny = p && p.id !== 'docasny' && !M.app.dok.uzly.length && !(M.app.dok.poznamky || []).length
        && /^Projekt \d+$/.test(p.nazev) && M.historie.zaznamy.length <= 1;
      if (!prazdny || !db) {
        if (await U.ulozTed()) return true;
        // neuložilo se (soukromé okno bez úložiště, plný disk…): změny by se ztratily – zeptat se
        const neco = M.app.dok.uzly.length || (M.app.dok.poznamky || []).length;
        if (!neco) return true;
        return Dialog.potvrd('Projekt se nepodařilo uložit v prohlížeči. Pokračovat a jeho změny zahodit? '
          + '(Zrušit = zůstat a stáhnout si ho přes Soubor → Uložit .modelar.)');
      }
      clearTimeout(casovac); casovac = null;
      try { await pozadavek(transakce('projekty', 'readwrite').objectStore('projekty').delete(p.id)); } catch (e) { /* nevadí */ }
      return true;
    }

    U.otevri = async function (id) {
      // znovu otevřít ten samý: nic nepřepínat (Zpět/Znovu i stav zůstanou)
      if (M.app.projekt && M.app.projekt.id === id) { await U.ulozTed(); return M.app.projekt; }
      if (!await opust()) return null;
      const p = await pozadavek(transakce('projekty').objectStore('projekty').get(id));
      if (!p) throw new Error('projekt nenalezen');
      await nactiZdroje(M.zdrojeUzlu(p.dok.uzly));
      pouzij(p);
      return p;
    };

    /** Nový prázdný projekt (uloží se při první změně). */
    U.novy = async function (nazev) {
      if (!await opust()) return false;
      const n = nazev || await dalsiNazev();
      pouzij({ id: 'p' + M.noveId(), nazev: n, vytvoreno: Date.now(), dok: M.novyDokument(), deska: null, kamera: null });
      return U.ulozTed();
    };

    /** Projekt z otevřeného souboru (už ověřený M.projekt.cti) jako nový projekt. */
    U.zeSouboru = async function (p) {
      if (!await opust()) return false;
      for (const [k, v] of p.zdroje) if (!M.zdroje.has(k)) M.zdroje.set(k, v);
      // stejný soubor otevřený podruhé: „Název (2)“, ať se projekty v přehledu dají rozlišit
      const nazvy = new Set((await U.seznam()).map(x => x.nazev));
      let nazev = p.nazev;
      for (let i = 2; nazvy.has(nazev); i++) nazev = `${p.nazev} (${i})`;
      pouzij({ id: 'p' + M.noveId(), nazev, vytvoreno: Date.now(), dok: p.dok, deska: p.deska, kamera: p.kamera });
      return U.ulozTed();
    };

    async function dalsiNazev() {
      const nazvy = new Set((await U.seznam()).map(p => p.nazev));
      for (let i = 1; ; i++) if (!nazvy.has('Projekt ' + i)) return 'Projekt ' + i;
    }

    U.prejmenuj = function (nazev) {
      if (!M.app.projekt) return;
      M.app.projekt.nazev = String(nazev).trim().slice(0, 120) || 'Bez názvu';
      M.vysli('projekt', M.app.projekt);
      U.naplanuj();
    };

    U.duplikuj = async function (id) {
      await U.ulozTed();
      const p = await pozadavek(transakce('projekty').objectStore('projekty').get(id));
      const kopie = Object.assign({}, p, { id: 'p' + M.noveId(), nazev: p.nazev + ' (kopie)', vytvoreno: Date.now(), upraveno: Date.now() });
      await pozadavek(transakce('projekty', 'readwrite').objectStore('projekty').put(kopie));
      return kopie;
    };

    /** Smaže projekt a geometrie, které už žádný projekt nepoužívá. */
    U.smaz = async function (id) {
      // mazaný otevřený projekt: zapomenout ho dřív, jinak by ho otevření dalšího (ulozTed) zase uložilo
      if (M.app.projekt && M.app.projekt.id === id) { clearTimeout(casovac); casovac = null; M.app.projekt = null; }
      await pozadavek(transakce('projekty', 'readwrite').objectStore('projekty').delete(id));
      const zbyle = await U.seznam();
      const pouzite = new Set();
      for (const p of zbyle) M.zdrojeUzlu(p.dok.uzly, pouzite);
      for (const t of await U.tvary()) M.zdrojeUzlu(t.tvar.uzly, pouzite);
      if (M.app.projekt) M.zdrojeUzlu(M.app.dok.uzly, pouzite);
      const st = transakce('zdroje', 'readwrite').objectStore('zdroje');
      const klice = await pozadavek(st.getAllKeys());
      for (const k of klice) if (!pouzite.has(k)) { st.delete(k); ulozeneZdroje.delete(k); }
      if (!M.app.projekt) {
        // otevřít jiný projekt; když to selže (poškozený), aspoň nový – bez projektu by se přestalo ukládat
        try { if (zbyle.length) await U.otevri(zbyle[0].id); else await U.novy(); }
        catch (e) { console.error('Modelář: projekt nejde otevřít', e); await U.novy(); }
      }
    };

    // ------------------------------------------------------------ vlastní tvary
    /** Seznam vlastních tvarů [{id, nazev, vytvoreno, tvar}] (nejnovější první). */
    U.tvary = async function () {
      if (!db) return [];
      const vse = await pozadavek(transakce('tvary').objectStore('tvary').getAll());
      return vse.sort((a, b) => b.vytvoreno - a.vytvoreno);
    };
    /** Uloží tvar (z M.tvarZUzlu) i s geometriemi importovaných modelů. */
    U.ulozTvar = async function (tvar) {
      if (!db) throw new Error('úložiště prohlížeče není k dispozici');
      const z = { id: 't' + M.noveId(), nazev: tvar.nazev, vytvoreno: Date.now(), tvar };
      await new Promise((resolve, reject) => {
        const t = transakce(['tvary', 'zdroje'], 'readwrite');
        t.objectStore('tvary').put(z);
        for (const id of tvar.zdroje) {
          const g = M.sitZdroje(id);
          t.objectStore('zdroje').put(zaznamZdroje(id, g));
        }
        t.oncomplete = () => { for (const id of tvar.zdroje) ulozeneZdroje.add(id); resolve(); }; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('zápis přerušen'));
      });
      M.vysli('tvary');
      return z;
    };
    U.smazTvar = async function (id) {
      await pozadavek(transakce('tvary', 'readwrite').objectStore('tvary').delete(id));
      M.vysli('tvary');
    };
    /** Před vložením tvaru: geometrie importovaných modelů do M.zdroje. */
    U.nactiZdroje = ids => nactiZdroje(ids);

    /** Načte projekt (bez přepnutí) – pro stažení souboru z přehledu. */
    U.nacti = async function (id) {
      const p = await pozadavek(transakce('projekty').objectStore('projekty').get(id));
      await nactiZdroje(M.zdrojeUzlu(p.dok.uzly));
      return p;
    };

    /** Start: otevřít naposledy upravovaný projekt, jinak nový. */
    U.start = async function () {
      try {
        db = await otevriDb();
        U.dostupne = true;
        // jiná karta chce databázi povýšit (nová verze aplikace): tahle ji pustí, jinak by ji zablokovala
        db.onversionchange = () => { try { db.close(); } catch (e) { /* už zavřená */ } db = null; U.dostupne = false;
          M.vysli('chybaUlozeni', new Error('aplikace byla aktualizována v jiné kartě – obnov stránku')); };
      } catch (e) {
        console.warn('Modelář: úložiště prohlížeče není k dispozici, projekty se neuloží.', e);
        M.app.projekt = { id: 'docasny', nazev: 'Bez názvu', vytvoreno: Date.now() };
        M.vysli('projekt', M.app.projekt);
        M.vysli('chybaUlozeni', e);
        return;
      }
      let posledni = null;
      try { posledni = localStorage.getItem(KLIC_POSLEDNI); } catch (e) { /* bez úložiště */ }
      const vse = await U.seznam();
      const cil = vse.find(p => p.id === posledni) || vse[0];
      if (cil) {
        try { await U.otevri(cil.id); return; }
        catch (e) { console.error('Modelář: projekt nejde otevřít', e); Dialog.chyba('Poslední projekt nejde otevřít: ' + e.message); }
      }
      await U.novy();
    };

    // výpočty doběhly a poslední náhled byl bez nich: uložit znovu s úplným náhledem
    M.na('vypocty', n => { if (!n && nahledNeuplny && M.app.projekt && db) { nahledNeuplny = false; clearTimeout(casovac); casovac = setTimeout(() => U.ulozTed(true), 300); } });
    // automatické ukládání
    M.na('dokument', e => { if (!e.docasne && M.app.projekt && e.popis !== 'Otevřít') U.naplanuj(); });
    M.na('deska', () => U.naplanuj());
    addEventListener('pagehide', () => { if (casovac) U.ulozTed(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && casovac) U.ulozTed(); });
    return U;
  };
})(MDL);
