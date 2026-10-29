/* Lamamp – geometrie oken (WA_OKNA): přichytávání k sobě a k okrajům plochy, skupina přichycených oken,
   posun oken pod zmenšeným/zvětšeným oknem. Vše v pixelech skinu; okno = { id, x, y, w, h }. Bez DOM. */
(function () {
  'use strict';

  const PRICHYT = 10;
  const prekryv = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

  // poloha posouvaného okna (nebo skupiny s obálkou `o`) přichycená k ostatním oknům a okrajům plochy
  function prichyt(o, ostatni, plocha, vzd = PRICHYT) {
    let { x, y } = o, nejX = vzd + 1, nejY = vzd + 1;
    const zkusX = (cil) => { const d = Math.abs(cil - o.x); if (d < nejX) { nejX = d; x = cil; } };
    const zkusY = (cil) => { const d = Math.abs(cil - o.y); if (d < nejY) { nejY = d; y = cil; } };
    for (const b of ostatni) {
      if (prekryv(o.y - vzd, o.y + o.h + vzd, b.y, b.y + b.h)) {
        zkusX(b.x + b.w); zkusX(b.x - o.w);          // vedle sebe
        zkusX(b.x); zkusX(b.x + b.w - o.w);          // zarovnání okrajů
      }
      if (prekryv(o.x - vzd, o.x + o.w + vzd, b.x, b.x + b.w)) {
        zkusY(b.y + b.h); zkusY(b.y - o.h);
        zkusY(b.y); zkusY(b.y + b.h - o.h);
      }
    }
    if (plocha) { zkusX(0); zkusX(plocha.w - o.w); zkusY(0); zkusY(plocha.h - o.h); }
    return { x, y };
  }

  // dotýkají se okna hranou (s překryvem na druhé ose)?
  function dotyk(a, b) {
    const vod = (a.x + a.w === b.x || b.x + b.w === a.x) && prekryv(a.y, a.y + a.h, b.y, b.y + b.h);
    const svi = (a.y + a.h === b.y || b.y + b.h === a.y) && prekryv(a.x, a.x + a.w, b.x, b.x + b.w);
    return vod || svi;
  }
  // okna připojená k oknu `id` (přes další okna) – při tahu hlavního okna jdou s ním
  function skupina(okna, id) {
    const v = new Set([id]); let zmena = true;
    while (zmena) {
      zmena = false;
      for (const a of okna) if (!v.has(a.id) && okna.some(b => v.has(b.id) && dotyk(a, b))) { v.add(a.id); zmena = true; }
    }
    return v;
  }
  // okno změnilo výšku: okna přichycená pod ním (a pod nimi) se posunou o rozdíl
  function posunPod(okna, id, staraVyska) {
    const o = okna.find(a => a.id === id), d = o.h - staraVyska;
    if (!d) return [];
    const spodek = o.y + staraVyska, posunuta = [];
    const fronta = okna.filter(a => a.id !== id && a.y === spodek && prekryv(a.x, a.x + a.w, o.x, o.x + o.w));
    const hotovo = new Set([id]);
    while (fronta.length) {
      const a = fronta.shift();
      if (hotovo.has(a.id)) continue;
      hotovo.add(a.id);
      const stary = a.y + a.h;
      a.y += d; posunuta.push(a.id);
      for (const b of okna) if (!hotovo.has(b.id) && b.y === stary && prekryv(b.x, b.x + b.w, a.x, a.x + a.w)) fronta.push(b);
    }
    return posunuta;
  }
  // obálka skupiny oken
  function obalka(okna) {
    const x = Math.min(...okna.map(o => o.x)), y = Math.min(...okna.map(o => o.y));
    return { x, y, w: Math.max(...okna.map(o => o.x + o.w)) - x, h: Math.max(...okna.map(o => o.y + o.h)) - y };
  }

  window.WA_OKNA = { PRICHYT, prichyt, dotyk, skupina, posunPod, obalka };
})();
