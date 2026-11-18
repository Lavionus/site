/* viditelnost/worker.js – výpočet viewshedu, panoramatu a kumulativní viditelnosti mimo hlavní vlákno. */
importScripts('jadro.js');
const J = self.VIDITELNOST;
let m = null, potreby = null;   // potreby = výsledky jednotlivých stanovisek pro rychlou změnu výšky cíle
onmessage = e => {
  const z = e.data;
  try {
    if (z.typ === 'dem') { m = z.m; potreby = null; postMessage({ typ: 'dem', id: z.id }); return; }
    if (z.typ === 'vypocet') {
      const t0 = Date.now();
      const vs = J.viewshed(m, z.p);
      const pan = J.panorama(m, Object.assign({ krokAz: 0.2 }, z.p));
      postMessage({ typ: 'vypocet', id: z.id, vs, pan, ms: Date.now() - t0 },
        [vs.potreba.buffer, pan.start.buffer, pan.uhel.buffer, pan.vzd.buffer, pan.obzor.buffer, pan.obzorVzd.buffer]);
    }
    if (z.typ === 'kumul') {
      const t0 = Date.now(), info = [];
      potreby = z.seznam.map((p, i) => {
        postMessage({ typ: 'prubeh', id: z.id, f: i / z.seznam.length });
        try { const vs = J.viewshed(m, p); info.push({ zTer: vs.zTer, zOka: vs.zOka }); return vs.potreba; }
        catch (err) { info.push({ chyba: err.message }); return new Float32Array(m.sirka * m.vyska).fill(NaN); }
      });
      const kum = J.kumuluj(potreby, z.t);
      postMessage({ typ: 'kumul', id: z.id, kum, info, ms: Date.now() - t0 }, [kum.maska.buffer, kum.pocet.buffer]);
    }
    if (z.typ === 'kumulT') {
      if (!potreby) throw new Error('Kumulativní výpočet už není v paměti – spusťte ho znovu.');
      const kum = J.kumuluj(potreby, z.t);
      postMessage({ typ: 'kumul', id: z.id, kum }, [kum.maska.buffer, kum.pocet.buffer]);
    }
  } catch (err) { postMessage({ typ: 'chyba', id: z.id, zprava: err.message }); }
};
