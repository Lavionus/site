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

  /** Číslo z pole: desetinná čárka i tečka, mezery, jednotky (mm, cm, m, in, ″, °)
      a jednoduché výpočty: 60/2, 35 mm + 2,5, (10+5)*2, 1e3, −5. Nic se nevyhodnocuje jako kód.
      Chybný zápis vrací NaN. */
  M.prectiCislo = function (text) {
    let t = String(text == null ? '' : text).trim().toLowerCase()
      .replace(/[\u2212\u2013]/g, '-').replace(/[×·]/g, '*').replace(/÷|:/g, '/').replace(/\s+/g, ' ');
    if (!t) return NaN;
    // desetinná čárka: „1,5“ → 1.5 (čárka mezi číslicemi)
    t = t.replace(/(\d),(\d)/g, '$1.$2').replace(/(\d) (?=\d{3}(?!\d))/g, '$1');      // a „1 000“ = 1000
    const JEDNOTKY = { mm: 1, cm: 10, m: 1000, in: 25.4, '"': 25.4, '″': 25.4, '°': 1, deg: 1, '%': 1 };
    let i = 0;
    const mezery = () => { while (t[i] === ' ') i++; };
    function cislo() {
      mezery();
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(t.slice(i));
      if (!m) return NaN;
      i += m[0].length;
      let v = Number(m[0]);
      mezery();
      const j = /^(mm|cm|deg|in|m|"|″|°|%)(?![a-z])/.exec(t.slice(i));
      if (j) { v *= JEDNOTKY[j[1]]; i += j[0].length; }
      return v;
    }
    function cinitel() {
      mezery();
      if (t[i] === '-') { i++; return -cinitel(); }
      if (t[i] === '+') { i++; return cinitel(); }
      if (t[i] === '(') { i++; const v = vyraz(); mezery(); if (t[i] !== ')') return NaN; i++; return v; }
      return cislo();
    }
    function soucin() {
      let v = cinitel();
      for (;;) {
        mezery();
        if (t[i] === '*') { i++; v *= cinitel(); } else if (t[i] === '/') { i++; v /= cinitel(); } else return v;
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
    return i === t.length && isFinite(v) ? v : NaN;
  };

  /** Číslo s českým tvarem slova: M.pocet(2, 'těleso', 'tělesa', 'těles') → „2 tělesa“. */
  M.pocet = (n, jedno, dveAzCtyri, pet) => n + ' ' + (n === 1 ? jedno : n >= 2 && n <= 4 ? dveAzCtyri : pet);

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
