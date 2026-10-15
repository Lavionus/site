/* Modelář 3D – worker přesného jádra (OpenCascade přes occt-wasm, 22 MB).
   Spouští se až při první přesné úpravě nebo exportu/importu STEP.
   Zpráva {id, typ, uzel?, site?, zdroje?, polozky?, text?} → {id, ok, vysledek}
   nebo {id, ok: false, chyba}. typ: 'sit' (síť skupiny s úpravou {poz, idx, objem}),
   'hrany', 'plochy' (pro výběr), 'step' (text STEP z položek), 'importStep'.
   zdroje = geometrie importovaných modelů (i s textem STEP), worker si je pamatuje. */
/* global importScripts, MDL */
importScripts('../lib/three.0.160.0.min.js', '../lib/clipper.min.js', 'spolecne.js', 'jadro/sit.js', 'jadro/tvary.js',
  'jadro/model.js', 'jadro/skica.js', 'jadro/dily.js', 'jadro/soubory/stl.js', 'jadro/occt.js', '../lib/occt/occt.klasicky.js');

let O = null, chybaStartu = null;
const pripraveno = (async () => {
  self.OCCT_URL = new URL('../lib/occt/occt.klasicky.js', self.location.href).href;
  const m = await self.OcctWasmModule({ locateFile: f => new URL('../lib/occt/' + f, self.location.href).href, print: () => {}, printErr: () => {} });
  O = MDL.vytvorOcct(m);
})().catch(e => { chybaStartu = String(e && e.message || e); });

self.onmessage = async e => {
  const { id, typ, uzel, site, zdroje, polozky, text } = e.data;
  if (typ === 'zapomen') { for (const k of e.data.ids || []) MDL.zdroje.delete(k); return; }
  try {
    await pripraveno;
    if (chybaStartu) { self.postMessage({ id, ok: false, start: true, chyba: chybaStartu }); return; }
    if (zdroje) for (const [k, z] of Object.entries(zdroje)) MDL.zdroje.set(k, z);
    let vysledek, prenos = [];
    if (typ === 'sit') { vysledek = O.sitUzlu(uzel, site); prenos = [vysledek.poz.buffer, vysledek.idx.buffer]; }
    else if (typ === 'hrany') { vysledek = O.hrany(uzel, site); prenos = vysledek.map(h => h.body.buffer); }
    else if (typ === 'plochy') vysledek = O.plochy(uzel, site);
    else if (typ === 'step') vysledek = O.step(polozky);
    else if (typ === 'importStep') { vysledek = O.importStep(text); prenos = [vysledek.sit.poz.buffer, vysledek.sit.idx.buffer]; }
    else throw new Error('neznámý požadavek ' + typ);
    self.postMessage({ id, ok: true, vysledek }, prenos);
  } catch (err) {
    // výjimka WebAssembly není Error: bez zprávy by se ukázalo „[object WebAssembly.Exception]“
    const text = err instanceof Error ? err.message : (err && err.message) || 'přesné jádro výpočet nezvládlo';
    self.postMessage({ id, ok: false, chyba: String(text) });
  }
};
