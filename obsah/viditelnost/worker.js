/* viditelnost/worker.js – výpočet viewshedu a panoramatu mimo hlavní vlákno. */
importScripts('jadro.js');
const J = self.VIDITELNOST;
let m = null;
onmessage = e => {
  const z = e.data;
  try {
    if (z.typ === 'dem') { m = z.m; postMessage({ typ: 'dem', id: z.id }); return; }
    if (z.typ === 'vypocet') {
      const t0 = Date.now();
      const vs = J.viewshed(m, z.p);
      const pan = J.panorama(m, Object.assign({ krokAz: 0.2 }, z.p));
      postMessage({ typ: 'vypocet', id: z.id, vs, pan, ms: Date.now() - t0 },
        [vs.potreba.buffer, pan.start.buffer, pan.uhel.buffer, pan.vzd.buffer, pan.obzor.buffer, pan.obzorVzd.buffer]);
    }
  } catch (err) { postMessage({ typ: 'chyba', id: z.id, zprava: err.message }); }
};
