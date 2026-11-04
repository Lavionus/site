/* Předčítač – syntéza řeči Piper ve vlákně: espeak-ng (WASM) → fonémy → model ONNX → PCM.
   Zprávy: {typ:'hlas', id, model:ArrayBuffer, konfig} → {typ:'hotovo', id}
           {typ:'veta', id, text, rychlost, mluvci} → {typ:'pcm', id, pcm:Float32Array, ms} */
'use strict';
importScripts('../lib/onnx/ort.wasm.min.js', '../lib/piper/piper_phonemize.js');
ort.env.wasm.numThreads = 1;   // GitHub Pages nemá cross-origin isolation → bez SharedArrayBuffer
ort.env.wasm.wasmPaths = new URL('../lib/onnx/', location.href).href;

let sezeni = null, konfig = null, fonemizer = null, vystup = [];

function novyFonemizer() {
  return createPiperPhonemize({
    print: s => vystup.push(s),
    printErr: s => console.warn('espeak:', s),
    locateFile: u => new URL('../lib/piper/' + u, location.href).href,
  });
}

async function fonemy(text) {
  if (!fonemizer) fonemizer = await novyFonemizer();
  const spust = () => {
    vystup = [];
    fonemizer.callMain(['-l', konfig.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
    return vystup.flatMap(r => JSON.parse(r).phoneme_ids || []);
  };
  try { return spust(); }
  catch (e) { fonemizer = await novyFonemizer(); return spust(); }   // modul po exit() znovu
}

async function veta({ text, rychlost = 1, mluvci = 0 }) {
  const ids = await fonemy(text);
  if (!ids.length) return new Float32Array(0);
  const inf = konfig.inference || {};
  const vstupy = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.of(BigInt(ids.length)), [1]),
    scales: new ort.Tensor('float32', Float32Array.of(inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / rychlost, inf.noise_w ?? 0.8), [3]),
  };
  if ((konfig.num_speakers || 1) > 1) vstupy.sid = new ort.Tensor('int64', BigInt64Array.of(BigInt(mluvci)), [1]);
  const { output } = await sezeni.run(vstupy);
  return output.data.slice();   // vlastní buffer – jde předat bez kopie
}

self.onmessage = async ({ data: z }) => {
  try {
    if (z.typ === 'hlas') {
      if (sezeni) await sezeni.release();
      sezeni = null;
      konfig = z.konfig;
      sezeni = await ort.InferenceSession.create(z.model, { executionProviders: ['wasm'] });
      if (!fonemizer) fonemizer = await novyFonemizer();
      postMessage({ typ: 'hotovo', id: z.id });
    } else if (z.typ === 'veta') {
      const t0 = performance.now();
      const pcm = await veta(z);
      postMessage({ typ: 'pcm', id: z.id, pcm, ms: performance.now() - t0 }, [pcm.buffer]);
    }
  } catch (e) {
    postMessage({ typ: 'chyba', id: z.id, zprava: String(e && e.message || e) });
  }
};
