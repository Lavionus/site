/* Razítka – výpočetní worker: měření tloušťky čar (Clipper) a stavba těles (manifold-3d) mimo hlavní vlákno.
   Zpráva {id, p, mot} (mot = 2D motiv z RAZ.motiv bez fontu) → {id, ok, mer, dily: [{jmeno, nazev, poz, idx, objem, rod,
   kontrola, previsy}], chyba}; pole sítí se předávají bez kopírování. Manifold v klasické podobě kvůli importScripts. */
/* global importScripts, RAZ, KRAB */
self.window = self;   // krabicky/jadro.js se v prohlížeči vystavuje přes window
importScripts('../lib/clipper.min.js', '../krabicky/jadro.js', 'jadro.js', '../lib/manifold/manifold.klasicky.js');

let w = null, chybaStartu = null;
const pripraveno = (async () => {
  self.MANIFOLD_URL = new URL('../lib/manifold/manifold.klasicky.js', self.location.href).href;
  w = await self.ManifoldModule({ locateFile: f => new URL('../lib/manifold/' + f, self.location.href).href });
  w.setup();
})().catch(e => { chybaStartu = String(e && e.message || e); });

self.onmessage = async e => {
  const { id, p, mot } = e.data;
  try {
    const mer = RAZ.mereni(p, mot);
    await pripraveno;
    if (chybaStartu) { self.postMessage({ id, ok: false, mer, chyba: 'Geometrické jádro (manifold-3d) se nenačetlo: ' + chybaStartu }); return; }
    const s = RAZ.sestav(w, p, mot);
    const dily = s.dily.map(d => Object.assign(d, { kontrola: KRAB.kontrolaSite(d.poz, d.idx), previsy: RAZ.previsy(d.poz, d.idx) }));
    self.postMessage({ id, ok: !s.chyba, mer, dily, chyba: s.chyba }, dily.flatMap(d => [d.poz.buffer, d.idx.buffer]));
  } catch (err) {
    self.postMessage({ id, ok: false, chyba: String(err && err.message || err) });
  }
};
