/* Kódování GIF/APNG a odhad velikosti mimo hlavní vlákno (stránka nezamrzne). */
importScripts('jadro.js');
const A = self.ANIMACE_GIF;

onmessage = async e => {
  const { id, typ, snimky, volby } = e.data;
  try {
    const prubeh = p => postMessage({ id, prubeh: p });
    let vysledek;
    if (typ === 'gif') vysledek = A.kodujGif(snimky, Object.assign({}, volby, { priPrubehu: prubeh }));
    else if (typ === 'apng') vysledek = await A.zapisApng(snimky, Object.assign({}, volby, { priPrubehu: prubeh }));
    else if (typ === 'odhad') vysledek = await A.odhadVelikosti(snimky, volby.format, volby, 6, volby.celkem);
    else throw new Error('Neznámá úloha ' + typ);
    postMessage({ id, hotovo: vysledek }, vysledek instanceof Uint8Array ? [vysledek.buffer] : []);
  } catch (err) {
    postMessage({ id, chyba: String(err && err.message || err) });
  }
};
