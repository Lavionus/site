/* ============================================================
   fonty.js – sdílená knihovna písem pro stránky „3D text“
   (text3d.html) a „Převodník písma“ (prevod_pisma.html).

   Dodávané fonty leží vedle tohoto souboru a všechny jsou volně
   šiřitelné (SIL Open Font License 1.1, viz OFL.txt a LICENCE.md).
   Vlastní fonty, které si uživatel nahraje, se ukládají do IndexedDB
   (databáze `webapp_fonty`) – localStorage by na soubory o stovkách
   kB nestačil. Obě stránky běží na stejném originu, takže font
   nahraný v jedné je hned k dispozici i ve druhé.

     FONTY.seznam()        → Promise<[{id, nazev, druh, pro3d, vlastni, …}]>
     FONTY.pridej(file)    → Promise<záznam>   (uloží do IndexedDB)
     FONTY.smaz(id)        → Promise
     FONTY.data(id)        → Promise<ArrayBuffer>
     FONTY.rodina(id)      → Promise<'jméno rodiny pro CSS'>
     FONTY.opentype(id)    → Promise<opentype.Font>  (potřebuje lib/opentype.min.js)
   ============================================================ */
const FONTY = (function () {

  // Adresa složky s fonty se bere z adresy tohoto skriptu, aby
  // nezáleželo na tom, ze které stránky se modul načte.
  const ZAKLAD = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, '') : 'fonty/';
  })();

  /* druh: blok | patkove | psaci | sablona | hrave | historicke | pismo
     pro3d: tahy jsou dost silné na tisk ve výšce kolem 3 cm a víc
     pismo: latinka | nebo id přepisu z prepis.js, jehož znaky font kreslí
     licence: výchozí SIL OFL 1.1, jinak uvedeno                        */
  const KATALOG = [
    { id: 'bebas',      soubor: 'BebasNeue-Regular.ttf',      nazev: 'Bebas Neue',        druh: 'blok',       pro3d: true },
    { id: 'anton',      soubor: 'Anton-Regular.ttf',          nazev: 'Anton',             druh: 'blok',       pro3d: true },
    { id: 'archivo',    soubor: 'ArchivoBlack-Regular.ttf',   nazev: 'Archivo Black',     druh: 'blok',       pro3d: true },
    { id: 'russo',      soubor: 'RussoOne-Regular.ttf',       nazev: 'Russo One',         druh: 'blok',       pro3d: true },
    { id: 'fjalla',     soubor: 'FjallaOne-Regular.ttf',      nazev: 'Fjalla One',        druh: 'blok',       pro3d: true },
    { id: 'staatliches',soubor: 'Staatliches-Regular.ttf',    nazev: 'Staatliches',       druh: 'blok',       pro3d: true },
    { id: 'libsans',    soubor: 'LiberationSans-Bold.ttf',    nazev: 'Liberation Sans Bold', druh: 'blok',    pro3d: true },
    { id: 'rubikmono',  soubor: 'RubikMonoOne-Regular.ttf',   nazev: 'Rubik Mono One',    druh: 'blok',       pro3d: true },
    { id: 'bowlby',     soubor: 'BowlbyOneSC-Regular.ttf',    nazev: 'Bowlby One SC',     druh: 'blok',       pro3d: true },
    { id: 'alfaslab',   soubor: 'AlfaSlabOne-Regular.ttf',    nazev: 'Alfa Slab One',     druh: 'patkove',    pro3d: true },
    { id: 'libserif',   soubor: 'LiberationSerif-Bold.ttf',   nazev: 'Liberation Serif Bold', druh: 'patkove', pro3d: true },
    { id: 'abril',      soubor: 'AbrilFatface-Regular.ttf',   nazev: 'Abril Fatface',     druh: 'patkove',    pro3d: true },
    { id: 'ultra',      soubor: 'Ultra-Regular.ttf',          nazev: 'Ultra',             druh: 'patkove',    pro3d: true, licence: 'Apache 2.0' },
    { id: 'playfairsc', soubor: 'PlayfairDisplaySC-Black.ttf',nazev: 'Playfair Display SC Black', druh: 'patkove', pro3d: true },
    { id: 'marcellus',  soubor: 'Marcellus-Regular.ttf',      nazev: 'Marcellus',         druh: 'patkove',    pro3d: true },
    { id: 'diplomata',  soubor: 'Diplomata-Regular.ttf',      nazev: 'Diplomata',         druh: 'patkove',    pro3d: true },
    { id: 'saira',      soubor: 'SairaStencilOne-Regular.ttf',nazev: 'Saira Stencil One', druh: 'sablona',    pro3d: true },
    { id: 'blackops',   soubor: 'BlackOpsOne-Regular.ttf',    nazev: 'Black Ops One',     druh: 'sablona',    pro3d: true },
    { id: 'bungee',     soubor: 'Bungee-Regular.ttf',         nazev: 'Bungee',            druh: 'hrave',      pro3d: true },
    { id: 'titan',      soubor: 'TitanOne-Regular.ttf',       nazev: 'Titan One',         druh: 'hrave',      pro3d: true },
    { id: 'righteous',  soubor: 'Righteous-Regular.ttf',      nazev: 'Righteous',         druh: 'hrave',      pro3d: true },
    { id: 'bangers',    soubor: 'Bangers-Regular.ttf',        nazev: 'Bangers',           druh: 'hrave',      pro3d: true },
    { id: 'pressstart', soubor: 'PressStart2P-Regular.ttf',   nazev: 'Press Start 2P',    druh: 'hrave',      pro3d: true },
    { id: 'luckiest',   soubor: 'LuckiestGuy-Regular.ttf',    nazev: 'Luckiest Guy',      druh: 'hrave',      pro3d: true, licence: 'Apache 2.0' },
    { id: 'emblema',    soubor: 'EmblemaOne-Regular.ttf',     nazev: 'Emblema One',       druh: 'hrave',      pro3d: true },
    { id: 'sancreek',   soubor: 'Sancreek-Regular.ttf',       nazev: 'Sancreek (western)',druh: 'hrave',      pro3d: true },
    { id: 'vt323',      soubor: 'VT323-Regular.ttf',          nazev: 'VT323 (terminál)',  druh: 'hrave',      pro3d: true },
    { id: 'monoton',    soubor: 'Monoton-Regular.ttf',        nazev: 'Monoton (neon)',    druh: 'hrave',      pro3d: false },
    { id: 'audiowide',  soubor: 'Audiowide-Regular.ttf',      nazev: 'Audiowide',         druh: 'tech',       pro3d: true },
    { id: 'michroma',   soubor: 'Michroma-Regular.ttf',       nazev: 'Michroma',          druh: 'tech',       pro3d: true },
    { id: 'spacemono',  soubor: 'SpaceMono-Bold.ttf',         nazev: 'Space Mono Bold',   druh: 'tech',       pro3d: true },
    { id: 'majormono',  soubor: 'MajorMonoDisplay-Regular.ttf', nazev: 'Major Mono Display', druh: 'tech',    pro3d: false },
    { id: 'specialelite', soubor: 'SpecialElite-Regular.ttf', nazev: 'Special Elite (psací stroj)', druh: 'tech', pro3d: false, licence: 'Apache 2.0' },
    { id: 'lobster',    soubor: 'Lobster-Regular.ttf',        nazev: 'Lobster',           druh: 'psaci',      pro3d: true },
    { id: 'pacifico',   soubor: 'Pacifico-Regular.ttf',       nazev: 'Pacifico',          druh: 'psaci',      pro3d: true },
    { id: 'kaushan',    soubor: 'KaushanScript-Regular.ttf',  nazev: 'Kaushan Script',    druh: 'psaci',      pro3d: true },
    { id: 'greatvibes', soubor: 'GreatVibes-Regular.ttf',     nazev: 'Great Vibes',       druh: 'psaci',      pro3d: false },
    { id: 'courgette',  soubor: 'Courgette-Regular.ttf',      nazev: 'Courgette',         druh: 'psaci',      pro3d: true },
    { id: 'marck',      soubor: 'MarckScript-Regular.ttf',    nazev: 'Marck Script',      druh: 'psaci',      pro3d: true },
    { id: 'berkshire',  soubor: 'BerkshireSwash-Regular.ttf', nazev: 'Berkshire Swash',   druh: 'psaci',      pro3d: true },
    { id: 'patrick',    soubor: 'PatrickHand-Regular.ttf',    nazev: 'Patrick Hand (rukopis)', druh: 'psaci', pro3d: true },
    { id: 'amatic',     soubor: 'AmaticSC-Bold.ttf',          nazev: 'Amatic SC (křída)', druh: 'psaci',      pro3d: false },
    { id: 'allura',     soubor: 'Allura-Regular.ttf',         nazev: 'Allura',            druh: 'psaci',      pro3d: false },
    { id: 'parisienne', soubor: 'Parisienne-Regular.ttf',     nazev: 'Parisienne',        druh: 'psaci',      pro3d: false },
    { id: 'pinyon',     soubor: 'PinyonScript-Regular.ttf',   nazev: 'Pinyon Script',     druh: 'psaci',      pro3d: false },
    { id: 'italianno',  soubor: 'Italianno-Regular.ttf',      nazev: 'Italianno',         druh: 'psaci',      pro3d: false },
    { id: 'uncial',     soubor: 'UncialAntiqua-Regular.ttf',  nazev: 'Uncial Antiqua',    druh: 'historicke', pro3d: true },
    { id: 'pirata',     soubor: 'PirataOne-Regular.ttf',      nazev: 'Pirata One',        druh: 'historicke', pro3d: true },
    { id: 'medieval',   soubor: 'MedievalSharp.ttf',          nazev: 'MedievalSharp',     druh: 'historicke', pro3d: true },
    { id: 'cinzel',     soubor: 'CinzelDecorative-Bold.ttf',  nazev: 'Cinzel Decorative', druh: 'historicke', pro3d: true },
    { id: 'metamorph',  soubor: 'Metamorphous-Regular.ttf',   nazev: 'Metamorphous',      druh: 'historicke', pro3d: true },
    { id: 'grenze',     soubor: 'GrenzeGotisch-Variable.ttf', nazev: 'Grenze Gotisch (švabach)', druh: 'historicke', pro3d: true },
    { id: 'jacquard',   soubor: 'Jacquard24-Regular.ttf',     nazev: 'Jacquard 24 (tkaná gotika)', druh: 'historicke', pro3d: true },
    { id: 'fondamento', soubor: 'Fondamento-Regular.ttf',     nazev: 'Fondamento',        druh: 'historicke', pro3d: true },
    { id: 'imfell',     soubor: 'IMFellEnglish-Regular.ttf',  nazev: 'IM Fell English',   druh: 'historicke', pro3d: true },
    { id: 'eaglelake',  soubor: 'EagleLake-Regular.ttf',      nazev: 'Eagle Lake',        druh: 'historicke', pro3d: true },
    { id: 'newrocker',  soubor: 'NewRocker-Regular.ttf',      nazev: 'New Rocker',        druh: 'historicke', pro3d: true },
    { id: 'nosifer',    soubor: 'Nosifer-Regular.ttf',        nazev: 'Nosifer',           druh: 'horor',      pro3d: true },
    { id: 'butcherman', soubor: 'Butcherman-Regular.ttf',     nazev: 'Butcherman',        druh: 'horor',      pro3d: true },
    { id: 'eater',      soubor: 'Eater-Regular.ttf',          nazev: 'Eater',             druh: 'horor',      pro3d: false },
    { id: 'tengwar',    soubor: 'AlcarinTengwar-Bold.ttf',    nazev: 'Alcarin Tengwar Bold', druh: 'pismo', pismo: 'tengwar', pro3d: true },
    { id: 'tengwar-r',  soubor: 'AlcarinTengwar-Regular.ttf', nazev: 'Alcarin Tengwar',   druh: 'pismo', pismo: 'tengwar', pro3d: false },
    { id: 'runy',       soubor: 'NotoSansRunic-Regular.ttf',  nazev: 'Noto Sans Runic',   druh: 'pismo', pismo: 'runy',      pro3d: true },
    { id: 'hlaholice',  soubor: 'NotoSansGlagolitic-Regular.ttf', nazev: 'Noto Sans Glagolitic', druh: 'pismo', pismo: 'hlaholice', pro3d: true },
    { id: 'ogam',       soubor: 'NotoSansOgham-Regular.ttf',  nazev: 'Noto Sans Ogham',   druh: 'pismo', pismo: 'ogam',      pro3d: true },
    { id: 'hieroglyfy', soubor: 'NotoSansEgyptianHieroglyphs-Vyber.ttf', nazev: 'Noto Sans Egyptian Hieroglyphs (výběr)', druh: 'pismo', pismo: 'hieroglyfy', pro3d: true },
    { id: 'braille',    soubor: 'NotoSansSymbols2-Braille.ttf', nazev: 'Noto Sans Symbols 2 (Braille)', druh: 'pismo', pismo: 'braille', pro3d: true },
    { id: 'fenicke',    soubor: 'NotoSansPhoenician-Regular.ttf', nazev: 'Noto Sans Phoenician', druh: 'pismo', pismo: 'fenicke', pro3d: true },
    { id: 'etruske',    soubor: 'NotoSansOldItalic-Regular.ttf', nazev: 'Noto Sans Old Italic', druh: 'pismo', pismo: 'etruske', pro3d: true },
    { id: 'goticke',    soubor: 'NotoSansGothic-Regular.ttf', nazev: 'Noto Sans Gothic',  druh: 'pismo', pismo: 'goticke',   pro3d: true },
  ];

  const DRUHY = {
    blok: 'Bezpatková, tučná', patkove: 'Patková', sablona: 'Šablonová',
    hrave: 'Hravá', tech: 'Technická', psaci: 'Psací a ručně psaná', historicke: 'Historická a gotická',
    horor: 'Strašidelná', pismo: 'Jiná písma',
    vlastni: 'Vlastní fonty',
  };

  /* ---------- IndexedDB ---------- */
  let dbSlib = null;
  function db() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise((ok, chyba) => {
      if (!window.indexedDB) return chyba(new Error('Prohlížeč neumí IndexedDB'));
      const r = indexedDB.open('webapp_fonty', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fonty', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => chyba(r.error);
    });
    dbSlib.catch(() => { dbSlib = null; });
    return dbSlib;
  }
  function transakce(rezim, prace) {
    return db().then(d => new Promise((ok, chyba) => {
      const tx = d.transaction('fonty', rezim);
      const vysledek = prace(tx.objectStore('fonty'));
      tx.oncomplete = () => ok(vysledek && 'result' in vysledek ? vysledek.result : undefined);
      tx.onerror = () => chyba(tx.error);
      tx.onabort = () => chyba(tx.error || new Error('Transakce zrušena'));
    }));
  }

  /* ---------- seznam ---------- */
  function seznam() {
    const vestavene = KATALOG.map(f => Object.assign({ vlastni: false, pismo: 'latinka' }, f));
    return transakce('readonly', s => s.getAll())
      .then(zaznamy => (zaznamy || [])
        .sort((a, b) => a.pridano - b.pridano)
        .map(z => ({ id: z.id, nazev: z.nazev, druh: 'vlastni', vlastni: true, pismo: 'latinka',
                     pro3d: z.typ !== 'woff2', typ: z.typ, soubor: z.soubor, velikost: z.velikost })))
      .catch(() => [])
      .then(vlastni => vestavene.concat(vlastni));
  }

  function typSouboru(buf, jmeno) {
    const h = new Uint8Array(buf, 0, 4);
    const sig = String.fromCharCode(h[0], h[1], h[2], h[3]);
    if (sig === 'wOFF') return 'woff';
    if (sig === 'wOF2') return 'woff2';
    if (sig === 'OTTO') return 'otf';
    if (sig === 'true' || (h[0] === 0 && h[1] === 1 && h[2] === 0 && h[3] === 0)) return 'ttf';
    if (sig === 'ttcf') return 'ttc';
    const m = /\.(ttf|otf|woff2?)$/i.exec(jmeno || '');
    return m ? m[1].toLowerCase() : null;
  }

  // Jméno fontu se přečte z tabulky name (pokud je k dispozici
  // opentype.js), jinak se vezme název souboru bez přípony.
  function jmenoFontu(buf, soubor) {
    try {
      if (window.opentype) {
        const f = opentype.parse(buf);
        const n = f.names.fullName || f.names.fontFamily;
        const t = n && (n.en || Object.values(n)[0]);
        if (t) return t;
      }
    } catch (e) { /* woff2 apod. – nevadí */ }
    return soubor.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  }

  function pridej(file) {
    return file.arrayBuffer().then(buf => {
      const typ = typSouboru(buf, file.name);
      if (!typ || typ === 'ttc') throw new Error('Soubor „' + file.name + '“ není podporovaný font (TTF, OTF, WOFF, WOFF2).');
      const zaznam = {
        id: 'vlastni_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nazev: jmenoFontu(buf, file.name),
        soubor: file.name, typ, velikost: buf.byteLength,
        pridano: Date.now(), data: buf,
      };
      return transakce('readwrite', s => { s.put(zaznam); }).then(() => zaznam);
    });
  }

  function smaz(id) {
    delete cacheDat[id]; delete cacheRodin[id]; delete cacheOT[id];
    return transakce('readwrite', s => { s.delete(id); });
  }

  /* ---------- načítání ---------- */
  const cacheDat = {}, cacheRodin = {}, cacheOT = {};

  function najdiVKatalogu(id) { return KATALOG.find(f => f.id === id); }

  // Otevřeno přímo ze souboru (file://): prohlížeč pak soubory fontů
  // načíst nedovolí a místo písmen jsou prázdná políčka.
  const ZE_SOUBORU = location.protocol === 'file:';
  const HLASKA_SOUBOR = 'Font se nepodařilo načíst. Stránka je otevřená přímo ze souboru (file://) '
    + 'a chybí k němu záložní skript ve složce obsah/fonty/js/ (vyrobí ho fonty/sestav_js.py). '
    + 'Nebo spusťte ./test_local.sh a otevřete http://localhost:8000.';

  /* Záložní cesta: font zabalený do obyčejného skriptu (fonty/js/*.js,
     vyrábí je sestav_js.py). Soubor otevřený přímo z disku (file://)
     smí načíst <script>, ale ne fetch() – prohlížeč pak nedá stránce
     bajty fontu. Převodníku to nevadilo (písmo kreslí prohlížeč
     z url()), 3D text ale obrysy písmen čte z bajtů, a bez nich stál. */
  function nactiSkriptem(k) {
    return new Promise((ok, chyba) => {
      const sk = document.createElement('script');
      sk.src = ZAKLAD + 'js/' + k.soubor + '.js';
      sk.onload = () => {
        const b64 = window.FONTY_JS && window.FONTY_JS[k.soubor];
        sk.remove();
        if (!b64) return chyba(new Error('prázdný skript'));
        delete window.FONTY_JS[k.soubor];
        const bin = atob(b64), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        ok(u8.buffer);
      };
      sk.onerror = () => { sk.remove(); chyba(new Error('skript nenalezen')); };
      document.head.appendChild(sk);
    });
  }

  function data(id) {
    if (cacheDat[id]) return cacheDat[id];
    const k = najdiVKatalogu(id);
    let p;
    if (k) {
      p = fetch(ZAKLAD + k.soubor)
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.arrayBuffer();
        })
        .catch(() => nactiSkriptem(k).catch(() => {
          throw new Error(ZE_SOUBORU ? HLASKA_SOUBOR : 'Font ' + k.nazev + ' se nepodařilo stáhnout (jste offline a font ještě nebyl uložený?).');
        }));
    } else {
      p = transakce('readonly', s => s.get(id)).then(z => {
        if (!z) throw new Error('Vlastní font už není uložený.');
        return z.data;
      });
    }
    cacheDat[id] = p;
    p.catch(() => { delete cacheDat[id]; });
    return p;
  }

  /* Zaregistruje font pro CSS pod jménem odvozeným od id – tak se
     dva různé soubory se stejným vnitřním jménem nepomíchají.
     Když nejde přečíst soubor (Firefox z file:// apod.), zkusí se
     ještě obyčejné url() – to prohlížeč někdy pustí.               */
  function rodina(id) {
    if (cacheRodin[id]) return cacheRodin[id];
    const jmeno = 'fnt-' + id.replace(/[^a-z0-9-]/gi, '');
    const pridej = ff => ff.load().then(f => { document.fonts.add(f); return jmeno; });
    const k = najdiVKatalogu(id);
    const p = data(id)
      .then(buf => pridej(new FontFace(jmeno, buf)))
      .catch(chyba => {
        if (!k) throw chyba;
        return pridej(new FontFace(jmeno, `url("${ZAKLAD + k.soubor}")`)).catch(() => { throw chyba; });
      });
    cacheRodin[id] = p;
    p.catch(() => { delete cacheRodin[id]; });
    return p;
  }

  // Skutečné jméno rodiny uvnitř fontu – pod ním ho zná systém, když
  // si ho uživatel nainstaluje (potřeba pro kopírování do Wordu).
  function jmenoRodiny(id) {
    return otevriOT(id).then(f => {
      const n = f.names.preferredFamily || f.names.fontFamily;
      return (n && (n.en || Object.values(n)[0])) || '';
    }).catch(() => {
      const k = najdiVKatalogu(id);
      return k ? k.nazev.replace(/ Bold$/, '') : '';
    });
  }

  // Stáhne soubor fontu (k instalaci do systému).
  function stahni(id) {
    return data(id).then(buf => {
      const k = najdiVKatalogu(id);
      const jm = k ? k.soubor : 'font.' + (typSouboru(buf) || 'ttf');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'font/' + (typSouboru(buf) || 'ttf') }));
      a.download = jm;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    });
  }

  function otevriOT(id) {
    if (cacheOT[id]) return cacheOT[id];
    const p = data(id).then(buf => {
      if (!window.opentype) throw new Error('Chybí knihovna opentype.js');
      if (typSouboru(buf) === 'woff2') throw new Error('Formát WOFF2 neumí tahle stránka rozložit na obrysy. Použijte TTF nebo OTF.');
      return opentype.parse(buf);
    });
    cacheOT[id] = p;
    p.catch(() => { delete cacheOT[id]; });
    return p;
  }

  // Naplní <select> fonty seskupenými podle druhu. `popisek(f)` může
  // k názvu přidat poznámku (např. „tenké tahy“ u 3D stránky).
  function naplnVyber(select, fonty, vybrane, popisek) {
    select.innerHTML = '';
    const skupiny = {};
    for (const f of fonty) (skupiny[f.druh] = skupiny[f.druh] || []).push(f);
    for (const druh of Object.keys(DRUHY)) {
      if (!skupiny[druh]) continue;
      const og = document.createElement('optgroup');
      og.label = DRUHY[druh];
      for (const f of skupiny[druh]) {
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = f.nazev + (popisek ? popisek(f) : '');
        og.appendChild(o);
      }
      select.appendChild(og);
    }
    if (vybrane && fonty.some(f => f.id === vybrane)) select.value = vybrane;
  }

  /* ---------- vizuální výběr fontu ----------
     Tlačítko s ukázkou vybraného písma; po klepnutí panel s hledáním,
     filtrem podle druhu a mřížkou, kde je text vysázený každým fontem
     (fonty se stahují, až když se karta objeví v panelu).

       const v = FONTY.vyberFontu(kontejner, {
         onZmena(id), onNahrat(), onSmazat(font),
         ukazka: () => 'text',            // co vysázet na kartách
         filtr: f => true,                // které fonty nabídnout
         poznamka: f => '',               // štítek na kartě (např. „tenké“)
         doporucene: () => 'latinka',     // písmo, které se nabídne jako první
       });
       v.nastav(fonty, vybraneId);  v.hodnota;  v.obnovUkazky();          */
  function vlozStylVyberu() {
    if (document.getElementById('fv-styl')) return;
    const st = document.createElement('style');
    st.id = 'fv-styl';
    st.textContent = `
.fv{position:relative}
.fv-tlacitko{width:100%;display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;
  background:var(--bg-input);border:1px solid var(--border-strong);border-radius:6px;color:var(--text);font:inherit;text-align:left}
.fv-tlacitko:hover{border-color:var(--accent)}
.fv-tlacitko:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.fv-tlacitko .fv-vzor{font-size:1.55rem;line-height:1.15;min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fv-tlacitko .fv-popis{display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex:0 0 auto;max-width:48%}
.fv-tlacitko .fv-jmeno{font-size:.84rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.fv-tlacitko .fv-druh{font-size:.72rem;color:var(--text-faint)}
.fv-tlacitko .fv-sipka{color:var(--text-faint);flex:0 0 auto}
.fv-panel{position:fixed;z-index:1000;top:0;left:0;width:min(640px,calc(100vw - 24px));
  background:var(--bg-panel);border:1px solid var(--border-strong);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.45);
  display:flex;flex-direction:column;max-height:min(72vh,640px)}
.fv-panel[hidden]{display:none}
.fv-hlava{display:flex;flex-direction:column;gap:8px;padding:10px;border-bottom:1px solid var(--border)}
.fv-hledat{width:100%;padding:8px 10px;background:var(--bg-input);border:1px solid var(--border-strong);border-radius:6px;color:var(--text);font:inherit}
.fv-hledat:focus{outline:none;border-color:var(--accent)}
.fv-druhy{display:flex;flex-wrap:wrap;gap:4px}
.fv-druhy button{padding:4px 9px;border-radius:999px;border:1px solid var(--border-strong);background:var(--bg-control);color:var(--text-muted);font:inherit;font-size:.76rem;cursor:pointer}
.fv-druhy button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.fv-mrizka{overflow:auto;padding:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;min-height:120px}
.fv-karta{position:relative;display:flex;flex-direction:column;gap:4px;padding:8px 10px;text-align:left;cursor:pointer;min-width:0;
  background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;color:var(--text);font:inherit}
.fv-karta:hover,.fv-karta:focus-visible{border-color:var(--accent);outline:none}
.fv-karta[aria-selected="true"]{border-color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent)}
.fv-karta .fv-k-vzor{font-size:1.45rem;line-height:1.25;height:2.5em;overflow:hidden;overflow-wrap:anywhere;opacity:.35;transition:opacity .2s}
.fv-karta .fv-k-vzor.hotovo{opacity:1}
.fv-karta .fv-k-jmeno{font-size:.74rem;color:var(--text-muted);display:flex;gap:6px;align-items:center;min-width:0}
.fv-karta .fv-k-jmeno span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fv-stitek{flex:0 0 auto;font-size:.66rem;padding:1px 6px;border-radius:999px;background:var(--bg-control);color:var(--text-faint)}
.fv-smazat{position:absolute;top:4px;right:4px;width:24px;height:24px;border:none;border-radius:50%;background:transparent;color:var(--text-faint);cursor:pointer}
.fv-smazat:hover{background:var(--bg-hover);color:var(--danger)}
.fv-pata{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--border);font-size:.78rem;color:var(--text-faint)}
.fv-pata .fv-mezera{flex:1}
.fv-pata button{padding:6px 10px;border:1px solid var(--border-strong);border-radius:6px;background:var(--bg-control);color:var(--text);font:inherit;font-size:.8rem;cursor:pointer}
.fv-pata button:hover{border-color:var(--accent)}
.fv-prazdno{grid-column:1/-1;color:var(--text-faint);font-size:.85rem;padding:14px;text-align:center}
@media (max-width:600px){.fv-mrizka{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}}`;
    document.head.appendChild(st);
  }

  function vyberFontu(kontejner, o) {
    o = o || {};
    vlozStylVyberu();
    let fonty = [], hodnota = null, druh = 'vse', hledat = '';
    kontejner.classList.add('fv');
    kontejner.innerHTML = `
      <button type="button" class="fv-tlacitko" aria-haspopup="listbox" aria-expanded="false">
        <span class="fv-vzor">Aa</span>
        <span class="fv-popis"><span class="fv-jmeno"></span><span class="fv-druh"></span></span>
        <span class="fv-sipka" aria-hidden="true">▾</span>
      </button>
      <div class="fv-panel" hidden>
        <div class="fv-hlava">
          <input type="search" class="fv-hledat" placeholder="Hledat font…" aria-label="Hledat font">
          <div class="fv-druhy" role="group" aria-label="Druh písma"></div>
        </div>
        <div class="fv-mrizka" role="listbox" aria-label="Fonty"></div>
        <div class="fv-pata"><span class="fv-pocet"></span><span class="fv-mezera"></span>
          ${o.onNahrat ? '<button type="button" class="fv-nahrat">📂 Nahrát vlastní font…</button>' : ''}</div>
      </div>`;
    const q = s => kontejner.querySelector(s);
    const tl = q('.fv-tlacitko'), panel = q('.fv-panel'), mrizka = q('.fv-mrizka');
    const ukazka = () => ((o.ukazka && o.ukazka()) || 'Aa 123').split('\n').filter(Boolean)[0] || 'Aa 123';
    const pozor = 'IntersectionObserver' in window
      ? new IntersectionObserver(z => z.forEach(x => { if (x.isIntersecting) { pozor.unobserve(x.target); nactiKartu(x.target); } }), { root: mrizka, rootMargin: '120px' })
      : null;

    function nactiKartu(karta) {
      const vz = karta.querySelector('.fv-k-vzor');
      rodina(karta.dataset.id)
        .then(r => { vz.style.fontFamily = `"${r}", sans-serif`; vz.classList.add('hotovo'); })
        .catch(() => { vz.textContent = '⚠ nejde načíst'; vz.classList.add('hotovo'); });
    }

    function obnovTlacitko() {
      const f = fonty.find(x => x.id === hodnota);
      q('.fv-jmeno').textContent = f ? f.nazev : '—';
      q('.fv-druh').textContent = f ? (DRUHY[f.druh] || '') + (o.poznamka && o.poznamka(f) ? ' · ' + o.poznamka(f) : '') : '';
      const vz = q('.fv-vzor');
      vz.textContent = ukazka();
      if (hodnota) rodina(hodnota).then(r => { if (f && f.id === hodnota) vz.style.fontFamily = `"${r}", sans-serif`; }).catch(() => { vz.style.fontFamily = ''; });
    }

    function nabizene() {
      return fonty.filter(f => !o.filtr || o.filtr(f) || f.id === hodnota);
    }

    function kresliDruhy() {
      const box = q('.fv-druhy');
      const pritomne = new Set(nabizene().map(f => f.druh));
      if (druh !== 'vse' && !pritomne.has(druh)) druh = 'vse';
      box.innerHTML = '';
      const tl2 = (id, text) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = text; b.dataset.druh = id;
        b.setAttribute('aria-pressed', druh === id);
        box.appendChild(b);
      };
      tl2('vse', 'Vše');
      for (const d of Object.keys(DRUHY)) if (pritomne.has(d)) tl2(d, DRUHY[d]);
    }

    function kresliMrizku() {
      if (pozor) pozor.disconnect();
      mrizka.innerHTML = '';
      const text = ukazka();
      const h = hledat.trim().toLowerCase();
      const seznam = nabizene().filter(f => (druh === 'vse' || f.druh === druh) && (!h || f.nazev.toLowerCase().includes(h)));
      // doporučené písmo (např. tengwar při elfím přepisu) jde dopředu
      const dop = o.doporucene ? o.doporucene() : null;
      if (dop) seznam.sort((a, b) => (b.pismo === dop) - (a.pismo === dop));
      for (const f of seznam) {
        const k = document.createElement('div');
        k.className = 'fv-karta'; k.tabIndex = 0; k.dataset.id = f.id;
        k.setAttribute('role', 'option');
        k.setAttribute('aria-selected', f.id === hodnota);
        const vz = document.createElement('div'); vz.className = 'fv-k-vzor'; vz.textContent = text;
        const jm = document.createElement('div'); jm.className = 'fv-k-jmeno';
        const s = document.createElement('span'); s.textContent = f.nazev; jm.appendChild(s);
        const pozn = o.poznamka && o.poznamka(f);
        if (pozn) { const t = document.createElement('span'); t.className = 'fv-stitek'; t.textContent = pozn; jm.appendChild(t); }
        if (f.vlastni) { const t = document.createElement('span'); t.className = 'fv-stitek'; t.textContent = 'vlastní'; jm.appendChild(t); }
        k.append(vz, jm);
        if (f.vlastni && o.onSmazat) {
          const x = document.createElement('button');
          x.type = 'button'; x.className = 'fv-smazat'; x.textContent = '🗑'; x.title = 'Smazat font';
          x.setAttribute('aria-label', 'Smazat font ' + f.nazev);
          x.addEventListener('click', e => { e.stopPropagation(); o.onSmazat(f); });
          k.appendChild(x);
        }
        mrizka.appendChild(k);
        if (pozor) pozor.observe(k); else nactiKartu(k);
      }
      if (!seznam.length) mrizka.innerHTML = '<div class="fv-prazdno">Žádný font neodpovídá.</div>';
      q('.fv-pocet').textContent = `${seznam.length} ${seznam.length === 1 ? 'font' : seznam.length < 5 ? 'fonty' : 'fontů'}`;
    }

    /* Panel je position: fixed a umisťuje se podle tlačítka – jinak by
       ho ořízl rolovací boční panel stránky (overflow: auto). Když pod
       tlačítkem není místo, otevře se nad ním.                        */
    function umisti() {
      if (panel.hidden) return;
      const r = tl.getBoundingClientRect();
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const sirka = Math.min(640, vw - 24);
      const left = Math.max(12, Math.min(r.left, vw - sirka - 12));
      const dole = vh - r.bottom - 34, nahore = r.top - 12;
      const nahoru = dole < 320 && nahore > dole;
      const vyska = Math.min(640, Math.max(220, (nahoru ? nahore : dole) - 6));
      panel.style.width = sirka + 'px';
      panel.style.left = left + 'px';
      panel.style.maxHeight = vyska + 'px';
      panel.style.top = nahoru ? Math.max(8, r.top - 6 - Math.min(vyska, panel.scrollHeight)) + 'px' : (r.bottom + 6) + 'px';
    }
    window.addEventListener('resize', umisti);
    window.addEventListener('scroll', e => { if (!panel.contains(e.target)) umisti(); }, true);

    function otevri() {
      panel.hidden = false;
      tl.setAttribute('aria-expanded', 'true');
      kresliDruhy(); kresliMrizku();
      umisti();
      const vyb = mrizka.querySelector('[aria-selected="true"]');
      if (vyb) vyb.scrollIntoView({ block: 'nearest' });
      if (window.matchMedia('(pointer: fine)').matches) q('.fv-hledat').focus();
    }
    function zavri(fokus) {
      if (panel.hidden) return;
      panel.hidden = true;
      tl.setAttribute('aria-expanded', 'false');
      if (fokus) tl.focus();
    }
    function vyber(id) {
      hodnota = id;
      obnovTlacitko();
      zavri(true);
      if (o.onZmena) o.onZmena(id);
    }

    tl.addEventListener('click', () => panel.hidden ? otevri() : zavri());
    q('.fv-hledat').addEventListener('input', e => { hledat = e.target.value; kresliMrizku(); });
    q('.fv-druhy').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      druh = b.dataset.druh; kresliDruhy(); kresliMrizku();
    });
    mrizka.addEventListener('click', e => { const k = e.target.closest('.fv-karta'); if (k) vyber(k.dataset.id); });
    mrizka.addEventListener('keydown', e => {
      const k = e.target.closest('.fv-karta'); if (!k) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vyber(k.dataset.id); return; }
      const karty = [...mrizka.querySelectorAll('.fv-karta')];
      const i = karty.indexOf(k);
      const sloupcu = Math.max(1, Math.round(mrizka.clientWidth / k.offsetWidth));
      const kam = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: sloupcu, ArrowUp: -sloupcu }[e.key];
      if (kam) { e.preventDefault(); const n = karty[Math.max(0, Math.min(karty.length - 1, i + kam))]; n.focus(); }
    });
    if (o.onNahrat) q('.fv-nahrat').addEventListener('click', () => { zavri(); o.onNahrat(); });
    kontejner.addEventListener('keydown', e => { if (e.key === 'Escape') zavri(true); });
    document.addEventListener('pointerdown', e => { if (!kontejner.contains(e.target)) zavri(); });

    return {
      nastav(seznam, id) { fonty = seznam; hodnota = id; obnovTlacitko(); if (!panel.hidden) { kresliDruhy(); kresliMrizku(); } },
      get hodnota() { return hodnota; },
      set hodnota(id) { hodnota = id; obnovTlacitko(); },
      obnovUkazky() {
        obnovTlacitko();
        if (!panel.hidden) for (const v of mrizka.querySelectorAll('.fv-k-vzor')) v.textContent = ukazka();
      },
      obnovSeznam() { if (!panel.hidden) { kresliDruhy(); kresliMrizku(); } },
      zavri,
    };
  }

  return { KATALOG, DRUHY, ZE_SOUBORU, HLASKA_SOUBOR, seznam, pridej, smaz, data, rodina, jmenoRodiny, stahni, opentype: otevriOT, typSouboru, naplnVyber, vyberFontu };
})();
