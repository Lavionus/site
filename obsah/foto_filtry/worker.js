// Fotofiltry – výpočty mimo hlavní vlákno (stránka nezamrzne ani u velké fotky).
importScripts('jadro.js');
self.FF_platno = (w, h) => new OffscreenCanvas(w, h);
const FF = self.FOTOFILTRY;
const zdroje = {};          // klíč → obrázek
let mezi = { klic: '', obr: null };  // výsledek úprav + hotových kroků pro posledně kreslený zdroj

function zaklad(klic, upr, hotove, k) {
  const id = JSON.stringify([klic, upr, hotove]);
  if (mezi.klic !== id) mezi = { klic: id, obr: FF.zpracuj(zdroje[klic], upr, hotove, k) };
  return mezi.obr;
}

onmessage = e => {
  const m = e.data;
  try {
    if (m.typ === 'zdroj') {
      zdroje[m.klic] = { width: m.w, height: m.h, data: new Uint8ClampedArray(m.data) };
      mezi = { klic: '', obr: null };
      return;
    }
    if (m.typ === 'vypocet') {
      const z = zdroje[m.klic], k = Math.max(z.width, z.height) / 1000;
      let o = zaklad(m.klic, m.upr, m.hotove, k);
      if (m.aktivni) o = FF.aplikuj(o, m.aktivni, k);
      const data = new Uint8ClampedArray(o.data);
      postMessage({ typ: 'vysledek', id: m.id, w: o.width, h: o.height, data: data.buffer }, [data.buffer]);
      return;
    }
    if (m.typ === 'nahledy') {
      // miniatury všech filtrů nad aktuálním stavem (bez aktivního filtru)
      const z = zdroje[m.klic], k = Math.max(z.width, z.height) / 1000, zakl = FF.zpracuj(z, m.upr, m.hotove, k);
      for (const f of FF.FILTRY) {
        const o = FF.aplikuj(zakl, { id: f.id, p: {} }, k), data = new Uint8ClampedArray(o.data);
        postMessage({ typ: 'nahled', id: m.id, fid: f.id, w: o.width, h: o.height, data: data.buffer }, [data.buffer]);
      }
    }
  } catch (err) {
    postMessage({ typ: 'chyba', id: m.id, zprava: String(err && err.message || err) });
  }
};
