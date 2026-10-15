/* Modelář 3D – výpočetní worker: booleany skupin přes manifold-3d.
   Zpráva {id, typ: 'skupina', uzel, zdroje} → {id, ok, pozice, normaly, barvy,
   trojuhelniku, objem} (pole se předávají bez kopírování), při chybě
   {id, ok: false, chyba}. typ 'sit' vrátí indexovanou síť pro export
   {poz, idx, barvyTroj, paleta, objem}; typ 'barvy' vrátí {casti: [{barva, poz, idx, objem}]}
   (barevná skupina rozdělená na uzavřená tělesa podle barev). zdroje = geometrie importovaných
   modelů, které worker ještě nemá (pamatuje si je v MDL.zdroje). typ 'vykres'
   {site, volby} vrátí {vykres} (jadro/vykres.js). Mezipaměť výsledků je v jadro/booleany.js.
   Manifold je v klasické podobě (lib/manifold/manifold.klasicky.js), takže
   ho načte importScripts i v prohlížečích bez import() ve workeru. */
/* global importScripts, MDL */
importScripts('../lib/three.0.160.0.min.js', 'spolecne.js', 'jadro/sit.js', 'jadro/tvary.js',
  'jadro/model.js', 'jadro/skica.js', 'jadro/dily.js', 'jadro/booleany.js', 'jadro/vykres.js', '../lib/manifold/manifold.klasicky.js');

let B = null, chybaStartu = null;
const pripraveno = (async () => {
  self.MANIFOLD_URL = new URL('../lib/manifold/manifold.klasicky.js', self.location.href).href;
  const w = await self.ManifoldModule({ locateFile: f => new URL('../lib/manifold/' + f, self.location.href).href });
  w.setup();
  B = MDL.vytvorBooleany(w, 64);
})().catch(e => { chybaStartu = String(e && e.message || e); });

self.onmessage = async e => {
  const { id, typ, uzel, zdroje } = e.data;
  if (typ === 'zapomen') { for (const k of e.data.ids || []) MDL.zdroje.delete(k); return; }   // odvozené sítě, které už nikdo nepotřebuje
  if (typ === 'vykres') {
    // technický výkres ze světových sítí (u závitů trvá i sekundy, proto mimo hlavní vlákno)
    try { self.postMessage({ id, ok: true, vykres: MDL.vykres(e.data.site, e.data.volby) }); }
    catch (err) { self.postMessage({ id, ok: false, chyba: String(err && err.message || err) }); }
    return;
  }
  try {
    await pripraveno;
    // manifold se nenačetl (WASM nejde stáhnout): hlavní vlákno přepne na výpočet u sebe
    if (chybaStartu) { self.postMessage({ id, ok: false, start: true, chyba: chybaStartu }); return; }
    if (zdroje) for (const [k, z] of Object.entries(zdroje)) MDL.zdroje.set(k, z);
    if (typ === 'sit') {
      const r = B.vysledekSkupiny(uzel);
      self.postMessage({ id, ok: true, poz: r.sit.poz, idx: r.sit.idx, barvyTroj: r.barvyTroj, paleta: r.paleta, objem: r.objem },
        [r.sit.poz.buffer, r.sit.idx.buffer, r.barvyTroj.buffer]);
      return;
    }
    if (typ === 'barvy') {
      const casti = B.vysledekPodleBarev(uzel).map(c => ({ barva: c.barva, poz: c.sit.poz, idx: c.sit.idx, objem: c.objem }));
      self.postMessage({ id, ok: true, casti }, casti.flatMap(c => [c.poz.buffer, c.idx.buffer]));
      return;
    }
    if (typ !== 'skupina') throw new Error('neznámý požadavek ' + typ);
    const r = B.vysledekSkupiny(uzel);
    const z = MDL.zobrazovaciData(r.sit, 30, uzel.barevne ? r.barvyTroj : null, r.paleta);
    const prenos = [z.pozice.buffer, z.normaly.buffer];
    if (z.barvy) prenos.push(z.barvy.buffer);
    self.postMessage({ id, ok: true, pozice: z.pozice, normaly: z.normaly, barvy: z.barvy,
      trojuhelniku: r.sit.idx.length / 3, objem: r.objem }, prenos);
  } catch (err) {
    // pád WebAssembly (RuntimeError) poznat i podle jména – hlavní vlákno pak worker vymění
    const wasm = err && (err.name === 'RuntimeError' || (typeof WebAssembly !== 'undefined' && err instanceof WebAssembly.RuntimeError));
    self.postMessage({ id, ok: false, chyba: (wasm ? 'RuntimeError: ' : '') + String(err && err.message || err) });
  }
};
