/* ============================================================
   cpu8/sdileni.js – zakódování programu do odkazu (location.hash)
   'z' + base64url(deflate-raw(UTF-8))  – když prohlížeč umí CompressionStream
   'r' + base64url(UTF-8)               – záložní varianta bez komprese
   Dekódování je obranné: poškozený odkaz → srozumitelná chyba, rozbalený text nad LIMIT bajtů se přeruší
   (ochrana proti „kompresní bombě“), nad VAROVANI vrací příznak velky, aby se UI mohlo zeptat.
   ============================================================ */
(function (root) {
  'use strict';
  const LIMIT = 1024 * 1024, VAROVANI = 256 * 1024;
  const POSKOZENY = 'Odkaz je poškozený nebo neúplný';
  class SdileniChyba extends Error {}

  function naB64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const b = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'latin1').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function zB64url(t) {
    if (!/^[A-Za-z0-9_-]*$/.test(t) || t.length % 4 === 1) throw new SdileniChyba(POSKOZENY + ' (neplatné znaky).');
    t = t.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    let s;
    try { s = typeof atob === 'function' ? atob(t) : Buffer.from(t, 'base64').toString('latin1'); }
    catch (e) { throw new SdileniChyba(POSKOZENY + '.'); }
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function zabal(bytes) {
    const st = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  /** Rozbalí po kouscích a přeruší, když výsledek přesáhne limit. */
  async function rozbal(bytes, limit) {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const kusy = []; let celkem = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        celkem += value.length;
        if (celkem > limit) {
          try { await reader.cancel(); } catch (e) { /* nevadí */ }
          throw new SdileniChyba('Program v odkazu je příliš velký (přes ' + Math.round(limit / 1024) + ' KiB) – nenačten.');
        }
        kusy.push(value);
      }
    } catch (e) {
      if (e instanceof SdileniChyba) throw e;
      throw new SdileniChyba(POSKOZENY + '.');
    }
    const out = new Uint8Array(celkem); let o = 0;
    kusy.forEach(k => { out.set(k, o); o += k.length; });
    return out;
  }
  const umiKompresi = () => typeof CompressionStream === 'function' && typeof Blob === 'function' && typeof Response === 'function';

  async function zakoduj(text, bezKomprese) {
    const utf = new TextEncoder().encode(text);
    if (!bezKomprese && umiKompresi()) {
      try { return 'z' + naB64url(await zabal(utf)); } catch (e) { /* záloha níže */ }
    }
    return 'r' + naB64url(utf);
  }
  function utf8(data) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch (e) { throw new SdileniChyba(POSKOZENY + ' (neplatné UTF-8).'); }
  }
  /** Vrátí { text, velky } – velky = text přes 256 KiB (UI se má zeptat). Chyby jsou SdileniChyba s českou zprávou. */
  async function dekodujBezpecne(kod, limit) {
    limit = limit || LIMIT;
    if (!kod || kod.length < 2) throw new SdileniChyba(POSKOZENY + ' (chybí data).');
    const druh = kod[0], data = zB64url(kod.slice(1));
    let bajty;
    if (druh === 'r') {
      if (data.length > limit) throw new SdileniChyba('Program v odkazu je příliš velký – nenačten.');
      bajty = data;
    } else if (druh === 'z') {
      if (typeof DecompressionStream !== 'function') throw new SdileniChyba('Prohlížeč neumí rozbalit komprimovaný odkaz (chybí DecompressionStream).');
      bajty = await rozbal(data, limit);
    } else throw new SdileniChyba(POSKOZENY + ' (neznámý formát).');
    const text = utf8(bajty);
    if (!text.length && druh === 'z') throw new SdileniChyba(POSKOZENY + ' (prázdný obsah).');
    return { text, velky: bajty.length > VAROVANI };
  }
  async function dekoduj(kod, limit) { return (await dekodujBezpecne(kod, limit)).text; }

  const SDIL = { zakoduj, dekoduj, dekodujBezpecne, SdileniChyba, LIMIT, VAROVANI };
  if (typeof module !== 'undefined' && module.exports) module.exports = SDIL;
  else root.CPU8SDIL = SDIL;
})(typeof self !== 'undefined' ? self : this);
