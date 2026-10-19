/* Modelář 3D – společný základ: jmenný prostor MDL, události, barvy z CSS.
   Souřadnice: milimetry, osa Z nahoru, pracovní deska leží v Z = 0,
   X doprava, Y dozadu (pohled zepředu se dívá ve směru +Y). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  M.verze = '0.1';
  if (typeof THREE === 'undefined' && typeof require === 'function') {
    // v node (testy) se three.js načte ze složky lib
    globalThis.THREE = require('../lib/three.0.160.0.min.js');
  }

  // --- jednoduché události: M.na('zmena', fn), M.vysli('zmena', data)
  const posluchaci = {};
  /** Přihlásí posluchače; vrací funkci, která ho zase odhlásí. */
  M.na = function (jmeno, fn) {
    (posluchaci[jmeno] = posluchaci[jmeno] || []).push(fn);
    return () => { const p = posluchaci[jmeno]; const i = p ? p.indexOf(fn) : -1; if (i >= 0) p.splice(i, 1); };
  };
  M.vysli = function (jmeno, data) { (posluchaci[jmeno] || []).slice().forEach(fn => fn(data)); };     // kopie: posluchač se smí odhlásit za běhu

  /* Ukazatel čekání nad plochou (#cekani). Víc souběžných úloh: ukazuje se poslední
     přidaná. podil 0–1 = lišta průběhu, null = neurčitý průběh. Krátké úlohy (pod
     `zpozdeni` ms) se neukážou, ať ukazatel neblikne u každé drobnosti. */
  const ulohy = new Map();
  let casovacCekani = null;
  function prekresliCekani() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('cekani');
    if (!el) return;
    const viditelne = [...ulohy.values()].filter(u => u.ukazat);
    const u = viditelne[viditelne.length - 1];
    el.hidden = !u;
    if (!u) return;
    // text je v živé oblasti (čtečka ho přečte při změně fáze), procenta mimo ni – jinak by hlásila každé procento
    const t = document.getElementById('cekaniText');
    if (t.textContent !== u.text) t.textContent = u.text;
    const pr = document.getElementById('cekaniProcenta');
    if (pr) pr.textContent = u.podil != null ? `${Math.round(u.podil * 100)}\u00a0%` : '';
    el.classList.toggle('neurcite', u.podil == null);
    document.getElementById('cekaniLista').style.width = u.podil != null ? (u.podil * 100).toFixed(1) + '%' : '';
  }
  /** Začne nebo aktualizuje úlohu klic. */
  M.cekej = function (klic, text, podil = null, zpozdeni = 250) {
    const u = ulohy.get(klic);
    if (u) { u.text = text; u.podil = podil; }
    else {
      const n = { text, podil, ukazat: zpozdeni <= 0 };
      ulohy.set(klic, n);
      if (!n.ukazat) setTimeout(() => { if (ulohy.get(klic) === n) { n.ukazat = true; prekresliCekani(); } }, zpozdeni);
    }
    prekresliCekani();
  };
  /** Ukončí úlohu klic. */
  M.hotovoCekani = function (klic) { if (ulohy.delete(klic)) prekresliCekani(); };
  /** Počká, až prohlížeč vykreslí (ukazatel čekání se ukáže dřív, než začne těžký výpočet v hlavním vlákně). */
  // karta na pozadí rAF nevolá – tam stačí jen předat řízení (jinak by import / start čekal, než se karta ukáže)
  M.dejVykreslit = () => new Promise(ok => typeof requestAnimationFrame === 'function' && !(typeof document !== 'undefined' && document.hidden)
    ? requestAnimationFrame(() => setTimeout(ok, 0)) : setTimeout(ok, 0));

  M.st = Math.PI / 180;               // stupeň v radiánech
  M.omez = (x, a, b) => x < a ? a : x > b ? b : x;

  /** Čte barvu z CSS proměnné (v node vrací náhradní). */
  M.barvaCss = function (jmeno, nahradni) {
    if (typeof document === 'undefined') return nahradni;
    const v = getComputedStyle(document.documentElement).getPropertyValue(jmeno).trim();
    return v || nahradni;
  };
  M.svetlyMotiv = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';

  /** Formát čísla v mm s desetinnou čárkou, bez zbytečných nul. */
  M.mm = function (x, des = 1) {
    let s = (Math.round(x * 10 ** des) / 10 ** des).toFixed(des);
    if (s.includes('.')) s = s.replace(/\.?0+$/, '');      // nuly jen za desetinnou tečkou (20 → „20“, ne „2“)
    return (s === '-0' ? '0' : s).replace('.', ',');
  };

  /** Je otevřené modální okno (nebo průvodce)? Nemodální panely vpravo (měření, řez, historie,
      zaoblení) klávesové zkratky neblokují. */
  M.modalniOkno = function () {
    if (typeof document === 'undefined') return false;
    if (M.pruvodceKrok && M.pruvodceKrok() >= 0) return true;
    try { return !!document.querySelector('dialog:modal'); }
    catch (e) { return !!document.querySelector('dialog[open]:not([data-panel])'); }     // prohlížeč bez :modal: panely mají data-panel
  };

  /** Otevře nemodální panel vpravo; ostatní takové panely zavře (ležely by přes sebe).
      Zavírá se přes událost cancel, kterou si každý panel obsluhuje sám (uklidí režim, řez…). */
  M.otevriPanel = function (okno) {
    for (const d of document.querySelectorAll('dialog.okno.vedle[open]')) {
      if (d === okno) continue;
      const e = new Event('cancel', { cancelable: true });
      d.dispatchEvent(e);
      if (d.open) d.close();
    }
    okno.dataset.panel = '1';
    // telefon: boční panel by s panelem nástroje zakryl skoro celé těleso
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches) document.body.classList.remove('panel-ukazany');
    if (!okno.open) okno.show();
  };
  /** Skryje rozbalovací nabídku a srovná stav jejího tlačítka (aria-expanded). */
  M.zavriNabidku = function (n) {
    if (!n) return;
    n.hidden = true;
    const b = typeof document !== 'undefined' && document.querySelector(`[data-nabidka="${n.id}"]`);
    if (b) b.setAttribute('aria-expanded', 'false');
  };

  /** Jména, která nesmí mít proměnná projektu (jednotky, funkce, konstanty). */
  M.FUNKCE_VYRAZU = {
    sqrt: [1, Math.sqrt], abs: [1, Math.abs], round: [1, Math.round], floor: [1, Math.floor], ceil: [1, Math.ceil],
    sin: [1, x => Math.sin(x * Math.PI / 180)], cos: [1, x => Math.cos(x * Math.PI / 180)], tan: [1, x => Math.tan(x * Math.PI / 180)],
    min: [-1, Math.min], max: [-1, Math.max],
  };
  M.REZERVOVANA_JMENA = new Set(['mm', 'cm', 'm', 'in', 'deg', 'x', 'e', 'pi', ...Object.keys(M.FUNKCE_VYRAZU)]);
  /** Platné jméno proměnné: písmeno (i s diakritikou) nebo _, pak písmena, číslice, _; ne jednotka ani funkce. */
  M.jmenoPromenneOk = j => typeof j === 'string' && /^[\p{L}_][\p{L}\p{N}_]{0,31}$/u.test(j) && !M.REZERVOVANA_JMENA.has(j.toLowerCase());
  /** Jména proměnných použitá ve výrazu (malými písmeny, bez funkcí a pi). */
  M.promenneVeVyrazu = function (text) {
    const out = new Set(), t = String(text == null ? '' : text).toLowerCase();
    const re = /[\p{L}_][\p{L}\p{N}_]*/gu;
    let m;
    while ((m = re.exec(t))) {
      const j = m[0], pred = t[m.index - 1];
      if (pred && /[\p{N}.]/u.test(pred) && /^e\d*$/.test(j)) continue;       // exponent 1e3
      if (M.REZERVOVANA_JMENA.has(j) || M.FUNKCE_VYRAZU[j]) continue;
      out.add(j);
    }
    return [...out];
  };

  /** Číslo z pole: desetinná čárka i tečka, mezery, jednotky (mm, cm, m, in, ″, °)
      a jednoduché výpočty: 60/2, 35 mm + 2,5, (10+5)*2, 1e3, −5. Nic se nevyhodnocuje jako kód.
      promenne (Map nebo objekt jméno malými písmeny → číslo) dovolí jména proměnných projektu
      („D/2 + vule“); dál umí pi a funkce sqrt, abs, round, floor, ceil, min, max, sin/cos/tan (stupně).
      Chybný zápis nebo neznámé jméno vrací NaN. */
  M.prectiCislo = function (text, promenne = null) {
    let t = String(text == null ? '' : text).trim().toLowerCase()
      .replace(/[\u2212\u2013]/g, '-').replace(/[×·]/g, '*').replace(/÷|:/g, '/').replace(/\s+/g, ' ');
    if (!t || t.length > 200) return NaN;
    // desetinná čárka: „1,5“ → 1.5 (čárka mezi číslicemi)
    // „2x3“ / „2 x 3“ jako násobení (ne v exponentu ani v jednotce)
    t = t.replace(/(\d)\s*x\s*(?=[\d(.])/g, '$1*');
    t = t.replace(/(\d),(\d)/g, '$1.$2').replace(/(\d) (?=\d{3}(?!\d))/g, '$1');      // a „1 000“ = 1000
    const JEDNOTKY = { mm: 1, cm: 10, m: 1000, in: 25.4, '"': 25.4, '″': 25.4, '°': 1, deg: 1, '%': 1 };
    let i = 0;
    const mezery = () => { while (t[i] === ' ') i++; };
    function cislo() {
      mezery();
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(t.slice(i));
      if (!m) return NaN;
      i += m[0].length;
      return Number(m[0]);
    }
    /** Jednotka za součinem platí pro celý součin („1/2 in“ = 12,7 mm). */
    function jednotka() {
      mezery();
      const j = /^(mm|cm|deg|in|m|"|″|°|%)(?![a-z])/.exec(t.slice(i));
      if (!j) return null;
      i += j[0].length;
      return JEDNOTKY[j[1]];
    }
    let hloubka = 0;
    function cinitel() {
      mezery();
      if (t[i] === '-') { i++; return -cinitel(); }
      if (t[i] === '+') { i++; return cinitel(); }
      if (t[i] === '(') {
        if (++hloubka > 50) return NaN;                // zanoření bez konce: nesmysl, ne přetečení zásobníku
        i++; const v = vyraz(); mezery(); hloubka--;
        if (t[i] !== ')') return NaN;
        i++; return v;
      }
      const jm = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(t.slice(i));
      if (jm) {
        const j = jm[0];
        i += j.length;
        if (j === 'pi') return Math.PI;
        const f = M.FUNKCE_VYRAZU[j];
        if (f) {
          mezery();
          if (t[i] !== '(' || ++hloubka > 50) return NaN;
          i++;
          const arg = [vyraz()];
          for (;;) { mezery(); if (t[i] !== ',' && t[i] !== ';') break; i++; arg.push(vyraz()); }
          mezery(); hloubka--;
          if (t[i] !== ')' || (f[0] > 0 && arg.length !== f[0])) return NaN;
          i++; return f[1](...arg);
        }
        const v = !promenne ? undefined : promenne instanceof Map ? promenne.get(j) : Object.prototype.hasOwnProperty.call(promenne, j) ? promenne[j] : undefined;
        return typeof v === 'number' ? v : NaN;
      }
      return cislo();
    }
    function soucin() {
      let v = cinitel();
      for (;;) {
        mezery();
        if (t[i] === '*') { i++; v *= cinitel(); } else if (t[i] === '/') { i++; v /= cinitel(); }
        else { const j = jednotka(); if (j == null) return v; v *= j; }
      }
    }
    function vyraz() {
      let v = soucin();
      for (;;) {
        mezery();
        if (t[i] === '+') { i++; v += soucin(); } else if (t[i] === '-') { i++; v -= soucin(); } else return v;
      }
    }
    if (t[0] === '=') i = 1;                      // „=60/2“ jako v tabulkách
    const v = vyraz();
    mezery();
    if (i !== t.length || !isFinite(v)) return NaN;
    // součty desetinných čísel (0,1 + 0,2) bez binárního šumu; −0 jako 0
    const r = Math.abs(v) < 1e6 ? Math.round(v * 1e9) / 1e9 : v;
    return !isFinite(r) ? NaN : r === 0 ? 0 : r;
  };

  /** Hlídač snímku: událost 'kamera' chodí s KAŽDÝM vykresleným snímkem. Vrací funkci zmena(dalsi, vynutit),
      která řekne, jestli se od minula změnila kamera, velikost plátna, dokument, výběr, režim, rovina
      nebo hodnoty v poli dalsi (porovnání ===) – jinak překreslování SVG vrstvy nemá smysl. */
  M.hlidacSnimku = function (S) {
    let klic = '', hodnoty = [];
    return function (dalsi = [], vynutit = false) {
      const a = S.kamera.aktivni();
      const k = a.matrixWorld.elements.join(',') + '|' + a.projectionMatrix.elements.join(',') + '|' + S.kamera.sirka + 'x' + S.kamera.vyska;
      const h = [M.app.dok, M.app.vyber, M.app.rezim, M.app.rovina, M.app.pivot].concat(dalsi);
      const zmena = vynutit || k !== klic || h.length !== hodnoty.length || h.some((x, i) => x !== hodnoty[i]);
      klic = k; hodnoty = h;
      return zmena;
    };
  };

  /** Číslo s českým tvarem slova: M.pocet(2, 'těleso', 'tělesa', 'těles') → „2 tělesa“. */
  M.pocet = (n, jedno, dveAzCtyri, pet) => n + ' ' + (n === 1 ? jedno : n >= 2 && n <= 4 ? dveAzCtyri : pet);

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
