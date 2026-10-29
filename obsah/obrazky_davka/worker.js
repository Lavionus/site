/* obrazky_davka/worker.js – zpracování jednoho obrázku mimo hlavní vlákno (OffscreenCanvas). */
importScripts('jadro.js', 'vykresli.js');

let vodoznak = { klic: null, obr: null };

onmessage = async e => {
  const z = e.data;
  if (z.typ === 'test') {
    let podpora = false;
    try {
      const c = new OffscreenCanvas(2, 2);
      podpora = !!c.getContext('2d') && typeof c.convertToBlob === 'function' && typeof createImageBitmap === 'function';
    } catch (err) { /* bez podpory */ }
    postMessage({ typ: 'test', podpora });
    return;
  }
  try {
    if (z.vodoznak && z.vodoznak.klic !== vodoznak.klic) {
      vodoznak = { klic: z.vodoznak.klic, obr: await createImageBitmap(z.vodoznak.blob) };
    }
    const r = await OBRAZKY_DAVKA_KRESLENI.zpracujSoubor(z.soubor, z.kroky, z.vystup, z.typVstupu, z.vodoznak ? vodoznak.obr : null);
    postMessage({ id: z.id, ok: true, vysledek: r });
  } catch (err) {
    postMessage({ id: z.id, ok: false, chyba: String((err && err.message) || err) });
  }
};
