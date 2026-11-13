/* Rozbočka VZT – výpočetní worker: odvozené hodnoty, kontroly, stavba sítě (manifold), tisková poloha a podpory
   mimo hlavní vlákno, aby stránka při přepočtu nezamrzla.
   Zpráva {id, p} → {id, ok, o, H, sit, tisk, podpory, chyba, cas} (typovaná pole se předají bez kopírování);
   po startu jednou {start: true, ok} nebo {start: true, chyba} – pak stránka počítá sama. */
/* global importScripts, ROZB_VZT, KRAB */
self.window = self;              // krabicky/jadro.js se zapíše do window.KRAB
importScripts('jadro.js', '../krabicky/jadro.js', '../lib/manifold/manifold.klasicky.js');

let W = null;
const pripraveno = (async () => {
  self.MANIFOLD_URL = new URL('../lib/manifold/manifold.klasicky.js', self.location.href).href;
  W = await self.ManifoldModule({ locateFile: f => new URL('../lib/manifold/' + f, self.location.href).href });
  W.setup();
})();
pripraveno.then(() => self.postMessage({ start: true, ok: true }), e => self.postMessage({ start: true, ok: false, chyba: String(e && e.message || e) }));

/** Buffery typovaných polí ve výsledku – předají se bez kopírování. */
function buffery(x, out = new Set()) {
  if (!x || typeof x !== 'object') return out;
  if (ArrayBuffer.isView(x)) { out.add(x.buffer); return out; }
  for (const v of Array.isArray(x) ? x : Object.values(x)) buffery(v, out);
  return out;
}

self.onmessage = async e => {
  const { id, p } = e.data;
  try { await pripraveno; } catch (err) { return; }
  const R = ROZB_VZT, t0 = performance.now();
  let o = null, H = null;
  try {
    o = R.odvozene(p); H = R.kontroly(p, o);
    let sit = null, tisk = null, podpory = null, chyba = null;
    if (!H.some(h => h.uroven === 'chyba')) {
      try {
        sit = o.spojka ? R.postavSpojku(W, p, o) : R.postav(W, p, o);
        tisk = R.tiskova(sit, sit.orientace, p.tisk.previs, sit.roviny);
        sit.rez.tisk = R.tiskova(sit.rez, sit.orientace, p.tisk.previs, sit.roviny);
        if (p.podpory.zapnout && tisk.plochaPrevisu > 0) podpory = R.podpory(tisk, sit.idx, p.podpory);
        sit.ks = KRAB.kontrolaSite(sit.poz, sit.idx);   // uzavřenost sítě – ať ji nepočítá stránka
      } catch (err) { chyba = String(err && err.message || err); sit = null; tisk = null; }
    }
    const v = { id, ok: true, o, H, sit, tisk, podpory, chyba, cas: performance.now() - t0 };
    self.postMessage(v, [...buffery(v)]);
  } catch (err) {
    self.postMessage({ id, ok: false, o, H, chyba: String(err && err.message || err) });
  }
};
