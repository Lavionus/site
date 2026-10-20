/* Plakát s útržky – načítání písem v prohlížeči.
   Písmo se bere z base64 skriptu (funguje i z file://), z téhož bajtového obsahu vznikne
   FontFace pro náhled/PNG, metrika (opentype.js) pro jádro a data pro jsPDF. */
(function () {
  'use strict';
  const PUP = { metriky: {}, base64: {} };
  const slib = {};

  function nactiSkript(src) {
    return new Promise((ok, chyba) => {
      const s = document.createElement('script'); s.src = src;
      s.onload = () => ok(); s.onerror = () => chyba(new Error('Nelze načíst ' + src));
      document.head.appendChild(s);
    });
  }
  function b64NaBuffer(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  PUP.nacti = function (klic) {
    if (slib[klic]) return slib[klic];
    const p = PU.PISMA[klic];
    if (!p) return Promise.reject(new Error('Neznámé písmo ' + klic));
    slib[klic] = (async () => {
      window.FONTY_JS = window.FONTY_JS || {};
      if (!window.FONTY_JS[p.soubor]) await nactiSkript(p.js);
      const b64 = window.FONTY_JS[p.soubor];
      if (!b64) throw new Error('Písmo ' + p.soubor + ' chybí');
      const buf = b64NaBuffer(b64);
      PUP.metriky[klic] = PU.metrikaZOpentype(opentype.parse(buf.slice(0)));
      PUP.base64[klic] = b64;
      const ff = new FontFace(PUV.rodina(klic), buf.slice(0));
      await ff.load(); document.fonts.add(ff);
      return klic;
    })();
    slib[klic].catch(() => { delete slib[klic]; });
    return slib[klic];
  };
  /* všechny řezy potřebné pro stav (nadpis, text + tučné, pomocný popisek) */
  PUP.potrebne = function (stav) {
    const s = new Set(['lib_sans', 'lib_sans_b']);
    for (const k of [stav.pismoNadpis, stav.pismoText]) { if (PU.PISMA[k]) { s.add(k); if (PU.PISMA[k].tucny) s.add(PU.PISMA[k].tucny); } }
    return [...s];
  };
  PUP.nactiVse = function (klice) { return Promise.all(klice.map(PUP.nacti)); };
  PUP.maVse = (klice) => klice.every(k => PUP.metriky[k]);
  PUP.proPdf = function () {
    const o = {};
    for (const k of Object.keys(PUP.base64)) o[k] = { soubor: PU.PISMA[k].soubor, base64: PUP.base64[k] };
    return o;
  };
  window.PUP = PUP;
})();
