/* ============================================================
   i18n.js – sdílený překlad stránek do dalších jazyků.
   Vkládá se do <head> synchronně (bez defer/async) hned za theme.js.

   Čeština je zdroj: stránky se nepřepisují, český text v HTML
   i v JS je zároveň klíčem slovníku. Chybí-li překlad, zůstane
   čeština – nic se nerozbije.

   Postup při načtení:
     1. document.write připíše i18n/jazyky.js (rejstřík jazyků),
        ten zavolá I18N.rejstrik() → zvolí se jazyk
        (?lang= → localStorage webapp_lang → prohlížeč → náhradní;
        ?lang= se zároveň uloží).
     2. Pro češtinu konec – žádné slovníky, žádný překlad.
     3. Jinak se pro celý záložní řetězec (např. de → en → cs)
        připíšou i18n/<kod>/_seznam.js a _spolecne.js; seznam
        připíše i slovník stránky, pokud existuje (bez 404).
     4. Po DOMContentLoaded se přeloží textové uzly a atributy
        a MutationObserver pak hlídá, co stránka vykreslí později.
   Texty mimo DOM (plátno, PDF, dialogy, skládané věty) přes I18N.t().

   Načítá ho theme.js (je synchronně v <head> skoro všech stránek),
   ostatní stránky ho mají přímo. Přepnutí jazyka = uložit a znovu
   načíst stránku (I18N.nastav); iframe se načte znovu s rozcestníkem.

   lang/dir na <html> a skrytí těla do překladu jen u stránek se
   slovníkem – stránka bez slovníku zůstane česká i pro čtečky.
   ============================================================ */
(function (globalni) {
  'use strict';
  if (globalni.I18N) return;   // stránka ho má přímo i přes theme.js

  // ---------- jádro bez DOM (testuje se v node) ----------
  const PISMENO = /\p{L}/u;
  const MAX_CHYBI = 5000;   // čítač s písmeny by jinak množinu nafukoval donekonečna

  let rejstrik = [];
  let retez = ['cs'];       // zvolený jazyk + záložní, končí češtinou
  const slovniky = {};      // kod → Map(klíč → překlad)
  const vzory = {};         // kod → [{ re, jmena, hodnota }]
  const tagy = {};          // kod → { soubor: [hledací slova] } – katalog
  const chybi = new Set();
  const prelozeno = new Set();   // pro kontrolu pokrytí (_test/i18n_pokryti.py)

  const normalizuj = s => s.replace(/\s+/g, ' ').trim();
  const jazyk = kod => rejstrik.find(j => j.kod === kod);
  const aktualni = () => jazyk(retez[0]) || { kod: 'cs' };
  const locale = () => aktualni().locale || aktualni().kod;

  function nastavRejstrik(seznam) { rejstrik = seznam; }

  function vyberJazyk(pozadovany, ulozeny, prohlizec) {
    for (const kod of [pozadovany, ulozeny]) if (kod && jazyk(kod)) return kod;
    for (const p of prohlizec || []) {
      const kod = String(p).toLowerCase().split('-')[0];
      const j = rejstrik.find(j => j.stav !== 'test' && (j.kod === kod || (j.pribuzne || []).includes(kod)));
      if (j) return j.kod;
    }
    const nahradni = rejstrik.find(j => j.nahradni);
    return nahradni ? nahradni.kod : 'cs';
  }

  function nastavJazyk(kod) {
    retez = [];
    for (let k = kod; k && !retez.includes(k); ) {
      retez.push(k);
      const z = (jazyk(k) || {}).zaloha || [];
      k = z.find(x => !retez.includes(x));
    }
    if (!retez.includes('cs')) retez.push('cs');
  }

  function vzor(klic, hodnota) {
    const jmena = [];
    const zdroj = klic.split(/\{(\w+)\}/).map((cast, i) => {
      if (i % 2) { jmena.push(cast); return '(.+?)'; }
      return cast.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return { re: new RegExp('^' + zdroj + '$'), jmena, hodnota };
  }

  function pridej(kod, data) {
    const m = slovniky[kod] || (slovniky[kod] = new Map());
    const v = vzory[kod] || (vzory[kod] = []);
    for (const [klic, hodnota] of Object.entries(data)) {
      if (hodnota == null) continue;   // extraktor zakládá nepřeložené klíče jako null
      const k = normalizuj(klic);
      m.set(k, hodnota);
      // vzor jen tam, kde je kolem parametrů i něco jiného než mezery ("{n}" samo by sedělo na všechno)
      if (/\{\w+\}/.test(k) && /\S/.test(k.replace(/\{\w+\}/g, ''))) v.push(vzor(k, hodnota));
    }
  }

  // "1 234,5" i "1234.5" → 1234.5; prázdné nebo nesmysl → NaN
  function precti(s) {
    s = String(s).trim().replace(/[\s  ']/g, '');
    const carka = s.lastIndexOf(','), tecka = s.lastIndexOf('.');
    if (carka > tecka) s = s.replace(/\./g, '').replace(',', '.');
    else if (carka >= 0) s = s.replace(/,/g, '');
    return s === '' ? NaN : Number(s);
  }

  // hodnota je řetězec, nebo tvary množného čísla { one, few, many, other }
  function tvar(hodnota, param, kod) {
    if (typeof hodnota === 'string') return hodnota;
    const n = param && param.n != null ? precti(param.n) : NaN;
    const druh = isNaN(n) ? 'other' : new Intl.PluralRules((jazyk(kod) || {}).locale || kod).select(n);
    return hodnota[druh] ?? hodnota.other;
  }

  const dosad = (text, param) =>
    param ? text.replace(/\{(\w+)\}/g, (cele, j) => (param[j] != null ? param[j] : cele)) : text;

  // o 35 % delší text; delší výplň po slovech, aby se odstavec dál zalamoval
  const pseudo = s => {
    const n = Math.ceil(s.length * 0.35);
    return '⟦' + s + (n <= 10 ? '·'.repeat(n) : (' ' + '·'.repeat(9)).repeat(Math.ceil(n / 10))) + '⟧';
  };

  function najdi(klic, param) {
    for (const kod of retez) {
      if (kod === 'cs') return null;
      const h = slovniky[kod] && slovniky[kod].get(klic);
      if (h != null) return tvar(h, param, kod);
    }
    return null;
  }

  // Hodnoty parametrů se také přeloží, jsou-li ve slovníku: "{nazev} ({sym})" na "Milimetr (mm)" → "Millimetre (mm)",
  // "{n} {listu}" na "3 listy" → "3 sheets". Parametr smí sám sedět na vzor ("Vrstva {j}:"), hlouběji už ne.
  let hloubka = 0;
  function prelozParam(h) {
    const m = h.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!PISMENO.test(m[2])) return h;
    const p = najdi(m[2]) ?? najdiBezOkraju(m[2]) ?? najdiVzor(m[2]);
    return p == null ? h : m[1] + p + m[3];
  }
  function najdiVzor(text) {
    if (hloubka > 1) return null;
    for (const kod of retez) {
      if (kod === 'cs') return null;
      for (const v of vzory[kod] || []) {
        const r = v.re.exec(text);
        if (!r) continue;
        const param = {};
        hloubka++;
        try { v.jmena.forEach((j, i) => { param[j] = prelozParam(r[i + 1]); }); }
        finally { hloubka--; }
        return dosad(tvar(v.hodnota, param, kod), param);
      }
    }
    return null;
  }

  // Text bez okrajů, které nejsou písmena: "📋 Kopírovat", "Skóre: 12", "🧊 3D tisk",
  // "📖 Kniha (verze)". Zkouší se oba okraje, jen začátek a jen konec; na začátku
  // napřed bez číslic, aby "3D" zůstalo součástí textu.
  function najdiBezOkraju(k) {
    const sym = k.match(/^[^\p{L}\p{N}]*/u)[0], zac = k.match(/^[^\p{L}]*/u)[0];
    const kon = k.match(/[^\p{L}]*$/u)[0];
    // emoji jako první slovo katalogu, i když obsahuje písmeno: "ℹ️ O projektu", "🚫 .gitignore"
    const slovo = (k.match(/^(\S+\s+)/u) || ['', ''])[1];
    const emoji = /[^\p{L}\p{N}]/u.test(slovo.trim()) ? slovo : '';
    for (const [a, b] of [[sym, kon], [sym, ''], ['', kon], [zac, kon], [emoji, '']]) {
      if ((!a && !b) || a.length + b.length >= k.length) continue;
      const p = najdi(k.slice(a.length, k.length - b.length));
      if (p != null) return a + p + b;
    }
    return null;
  }

  function zapisChybi(klic) { if (chybi.size < MAX_CHYBI) chybi.add(klic); }

  // Překlad textu z DOM; null = nechat beze změny.
  function prelozText(text) {
    const k = normalizuj(text);
    if (!PISMENO.test(k) || retez[0] === 'cs') return null;
    if (aktualni().pseudo) return pseudo(k);
    const p = najdi(k) ?? najdiBezOkraju(k) ?? najdiVzor(k);
    if (p == null) zapisChybi(k);
    else if (prelozeno.size < MAX_CHYBI) prelozeno.add(k);
    return p;
  }

  // Jako překlad DOM (okraje, vzory), ale z kódu; bez překladu vrátí původní text.
  function preloz(text) {
    const p = prelozText(text);
    return p == null ? text : p;
  }

  function pridejTagy(kod, mapa) { Object.assign(tagy[kod] || (tagy[kod] = {}), mapa); }

  // hledací slova stránky katalogu ve zvoleném jazyce i v záložních (kromě češtiny – ta je v apps.js)
  const tagyStranky = soubor => retez.flatMap(kod => (tagy[kod] && tagy[kod][soubor]) || []);

  // Překlad z kódu. zdroj = český text, nebo české tvary { one, few, many, other }
  // (klíčem je pak tvar `other`). param: hodnoty pro {jmena}, n = počet, ctx = kontext.
  function t(zdroj, param) {
    const ceske = typeof zdroj === 'string' ? zdroj : zdroj.other;
    const vychozi = () => dosad(tvar(zdroj, param, 'cs'), param);
    if (retez[0] === 'cs') return vychozi();
    if (aktualni().pseudo) return pseudo(vychozi());
    let klic = normalizuj(ceske);
    if (param && param.ctx) klic += '@' + param.ctx;
    const p = najdi(klic, param);
    if (p != null) return dosad(p, param);
    zapisChybi(klic);
    return vychozi();
  }

  const I18N = {
    t, preloz, pridej, pridejTagy, tagy: tagyStranky, precti,
    get jazyk() { return retez[0]; },
    get locale() { return locale(); },
    jazyky: () => rejstrik.slice(),
    chybejici: () => [...chybi],
    prelozene: () => [...prelozeno],
    cislo: (x, volby) => new Intl.NumberFormat(locale(), volby).format(x),
    datum: (d, volby) => new Intl.DateTimeFormat(locale(), volby).format(d),
    mena: (x, mena = 'CZK') => new Intl.NumberFormat(locale(), { style: 'currency', currency: mena }).format(x),
    seznam() {},
    rejstrik: nastavRejstrik,
    _vyber: vyberJazyk, _nastavJazyk: nastavJazyk, _prelozText: prelozText,
  };
  globalni.I18N = I18N;
  if (typeof document === 'undefined') return;

  // ---------- napojení na stránku ----------
  const KLIC = 'webapp_lang';
  const KOREN = new URL('.', document.currentScript.src);
  const ATRIBUTY = ['title', 'placeholder', 'aria-label', 'alt', 'label'];
  const PRESKOC = 'script,style,noscript,code,pre,kbd,samp,textarea,[contenteditable]:not([contenteditable="false"]),[data-i18n="ne"]';
  const vystup = new WeakMap();      // textový uzel → co do něj naposledy zapsal překlad
  const vystupAtr = new WeakMap();   // prvek → { atribut: zapsaná hodnota }
  let pozorovatel = null;

  if (document.readyState !== 'loading' || document.currentScript.async || document.currentScript.defer) {
    console.warn('i18n.js se musí načíst synchronně v <head> – překlad vypnut');
    return;
  }

  const nacti = cesta => document.write('<script src="' + new URL(cesta, KOREN).href + '"><\/script>');

  function klicStranky() {
    const koren = decodeURIComponent(KOREN.pathname);
    let cesta = decodeURIComponent(location.pathname);
    if (!cesta.startsWith(koren)) return null;
    cesta = cesta.slice(koren.length);
    if (cesta === '' || cesta.endsWith('/')) cesta += 'index.html';
    return cesta.replace(/^obsah\//, '').replace(/\.html?$/, '');
  }
  const STRANKA = klicStranky();

  I18N.rejstrik = function (seznam) {
    nastavRejstrik(seznam);
    let pozadovany = null, ulozeny = null;
    try { pozadovany = new URLSearchParams(location.search).get('lang'); } catch {}
    try { ulozeny = localStorage.getItem(KLIC); } catch {}
    nastavJazyk(vyberJazyk(pozadovany, ulozeny, navigator.languages || [navigator.language]));
    // odkaz s ?lang= volbu i uloží – iframe a další stránky pak jedou ve stejném jazyce
    if (pozadovany === retez[0] && pozadovany !== ulozeny) {
      try { localStorage.setItem(KLIC, pozadovany); } catch {}
    }
    const j = aktualni();
    if (j.kod === 'cs') return;
    if (j.pseudo) oznac();
    for (const kod of retez) {
      if (kod === 'cs' || (jazyk(kod) || {}).pseudo) continue;
      nacti('i18n/' + kod + '/_seznam.js');
      nacti('i18n/' + kod + '/_spolecne.js');
    }
    document.addEventListener('DOMContentLoaded', zacni);
  };

  // stranky: které stránky mají vlastní slovník; sdilene: slovník → stránky, které ho
  // potřebují navíc (katalog, sdílený panel několika stránek)
  I18N.seznam = function (kod, stranky, sdilene) {
    if (!STRANKA) return;
    for (const [slovnik, kde] of Object.entries(sdilene || {})) {
      if (kde.includes(STRANKA)) nacti('i18n/' + kod + '/' + slovnik + '.js');
    }
    if (!stranky.includes(STRANKA)) return;
    nacti('i18n/' + kod + '/' + STRANKA + '.js');
    oznac();
  };

  I18N.nastav = function (kod) {
    try { localStorage.setItem(KLIC, kod); } catch {}
    location.reload();
  };

  // změna v jiné záložce
  window.addEventListener('storage', e => {
    if (e.key === KLIC && e.newValue !== retez[0]) location.reload();
  });

  // stránka bude přeložená: jazyk pro čtečky a prohlížeč, a dokud se
  // nepřeloží, tělo neprobliká česky (pojistka 3 s)
  let oznaceno = false;
  function oznac() {
    if (oznaceno) return;
    oznaceno = true;
    document.documentElement.lang = aktualni().kod;
    document.documentElement.dir = aktualni().smer || 'ltr';
    const styl = document.createElement('style');
    styl.textContent = 'html[data-i18n-ceka] body{visibility:hidden}';
    (document.head || document.documentElement).appendChild(styl);
    document.documentElement.setAttribute('data-i18n-ceka', '');
    setTimeout(odkryj, 3000);
  }
  function odkryj() { document.documentElement.removeAttribute('data-i18n-ceka'); }

  function vPreskocenem(uzel) {
    const el = uzel.nodeType === 1 ? uzel : uzel.parentElement;
    return !!(el && el.closest(PRESKOC));
  }

  function prelozUzel(uzel) {
    const text = uzel.data;
    if (vystup.get(uzel) === text) return;
    const p = prelozText(text);
    if (p == null) return;
    const novy = text.match(/^\s*/)[0] + p + text.match(/\s*$/)[0];
    vystup.set(uzel, novy);
    if (novy !== text) uzel.data = novy;
  }

  const tlacitko = el => el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type);

  function prelozAtr(el, atr) {
    const h = el.getAttribute(atr);
    if (h == null) return;
    let zapsano = vystupAtr.get(el);
    if (zapsano && zapsano[atr] === h) return;
    const p = prelozText(h);
    if (p == null) return;
    if (!zapsano) vystupAtr.set(el, zapsano = {});
    zapsano[atr] = p;
    if (p !== h) el.setAttribute(atr, p);
  }

  function prelozAtributy(el) {
    for (const a of ATRIBUTY) prelozAtr(el, a);
    if (tlacitko(el)) prelozAtr(el, 'value');
  }

  function prelozStrom(koren) {
    if (koren.nodeType === 3) return prelozUzel(koren);
    if (koren.nodeType !== 1) return;
    const chodec = document.createTreeWalker(koren, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && n.matches(PRESKOC) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = chodec.currentNode; n; n = chodec.nextNode()) {
      if (n.nodeType === 3) prelozUzel(n);
      else prelozAtributy(n);
    }
  }

  function zmeny(zaznamy) {
    for (const z of zaznamy) {
      if (z.type === 'childList') {
        for (const n of z.addedNodes) if (!vPreskocenem(n)) prelozStrom(n);
      } else if (!vPreskocenem(z.target)) {
        if (z.type === 'characterData') prelozUzel(z.target);
        else if (z.attributeName !== 'value' || tlacitko(z.target)) prelozAtr(z.target, z.attributeName);
      }
    }
    pozorovatel.takeRecords();   // zahodit záznamy o vlastních zápisech
  }

  function zacni() {
    prelozStrom(document.documentElement);
    odkryj();
    pozorovatel = new MutationObserver(zmeny);
    pozorovatel.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: [...ATRIBUTY, 'value'],
    });
  }

  nacti('i18n/jazyky.js');
})(typeof window !== 'undefined' ? window : globalThis);
