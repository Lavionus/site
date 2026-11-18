/* Worker Ověření pravosti fotografie – výpočty mimo hlavní vlákno.
   {id, ukol:'analyza', rgba, w, h, rozbor:{typ, dqt, sof}, kvalitaEla, nahled?:{rgba,w,h}} → {id, prubeh, faze}… → {id, vysledky}
   {id, ukol:'ela', q}       → nová mapa ELA pro poslední obrázek (posuvník kvality)
   {id, ukol:'ukazka', klic} → {id, ukazka:{bajty, maska, posun, zdroj, pravda, nazev}} */
importScripts('jadro.js');
let posledni = null;

onmessage = e => {
  const d = e.data, id = d.id;
  try {
    if (d.ukol === 'analyza') {
      posledni = { rgba: new Uint8ClampedArray(d.rgba), w: d.w, h: d.h };
      const { rgba, w, h } = posledni;
      const v = PRAVOST.analyzujVse({ rgba, w, h, rozbor: d.rozbor }, { kvalitaEla: d.kvalitaEla },
        (faze, p) => postMessage({ id, prubeh: p, faze }));
      v.nahled = d.nahled ? PRAVOST.porovnejNahled({ rgba, w, h }, d.nahled) : null;
      const prenos = [v.sum.rezidual.buffer];
      if (v.elaMapa) prenos.push(v.elaMapa.mapa.buffer);
      if (v.nahled) prenos.push(v.nahled.rozdil.buffer);
      postMessage({ id, vysledky: v }, prenos);
    } else if (d.ukol === 'ela') {
      if (!posledni) throw new Error('není načtený obrázek');
      const m = PRAVOST.ela(posledni.rgba, posledni.w, posledni.h, d.q);
      postMessage({ id, ela: m }, [m.mapa.buffer]);
    } else if (d.ukol === 'ukazka') {
      const u = PRAVOST.vytvorUkazku(d.klic);
      postMessage({ id, ukazka: { bajty: u.bajty, maska: u.maska, posun: u.posun || null, zdroj: u.zdroj || null, pravda: u.pravda, nazev: u.nazev, klic: u.klic, w: u.w, h: u.h } }, [u.bajty.buffer, u.maska.buffer]);
    }
  } catch (err) {
    postMessage({ id, chyba: String(err && err.message || err) });
  }
};
