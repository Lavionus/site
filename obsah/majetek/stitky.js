/* Evidence majetku – inventární štítky: QR matice → SVG a rozložení na arch A4 (bez DOM, testuje se v node). */
(function () {
  'use strict';

  /* Archy samolepicích etiket A4 (210 × 297 mm). Rozměry podle běžných typů, mm. */
  const ARCHY = {
    a70x37: { nazev: '70 × 37 mm, 3 × 8 (24 ks, bez okrajů)', w: 70, h: 37, sl: 3, ra: 8, levy: 0, horni: 0.5, mezX: 0, mezY: 0 },
    a64x34: { nazev: '63,5 × 33,9 mm, 3 × 8 (24 ks, typ L7159)', w: 63.5, h: 33.9, sl: 3, ra: 8, levy: 7.2, horni: 12.9, mezX: 2.5, mezY: 0 },
    a105x48: { nazev: '105 × 48 mm, 2 × 6 (12 ks)', w: 105, h: 48, sl: 2, ra: 6, levy: 0, horni: 4.5, mezX: 0, mezY: 0 },
    a38x21: { nazev: '38,1 × 21,2 mm, 5 × 13 (65 ks, typ L7651)', w: 38.1, h: 21.2, sl: 5, ra: 13, levy: 4.7, horni: 10.7, mezX: 2.5, mezY: 0 }
  };

  /* Rozložení: n štítků, „preskocit“ = kolik pozic na prvním archu je už spotřebováno. → [[{x,y,w,h,i}]] po stránkách. */
  function rozloz(arch, n, preskocit) {
    const a = typeof arch === 'string' ? ARCHY[arch] : arch;
    if (!a) throw new Error('Neznámý arch štítků.');
    const naArch = a.sl * a.ra;
    let poz = Math.max(0, Math.min(naArch - 1, Math.floor(preskocit || 0)));
    const stranky = []; let st = null;
    for (let i = 0; i < n; i++) {
      if (!st || poz >= naArch) { if (st) poz = 0; st = []; stranky.push(st); }
      const r = Math.floor(poz / a.sl), s = poz % a.sl;
      st.push({ i, x: +(a.levy + s * (a.w + a.mezX)).toFixed(2), y: +(a.horni + r * (a.h + a.mezY)).toFixed(2), w: a.w, h: a.h });
      poz++;
    }
    return stranky;
  }

  /* QR matice přes qrcode-generator (MIT, obsah/lib/qrcode/qrcode.js). Úroveň opravy M, verze automaticky. */
  function qrMatice(text, qrcode, uroven) {
    const q = qrcode(0, uroven || 'M');
    q.addData(String(text), 'Byte');
    q.make();
    const n = q.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r++) { const radek = []; for (let c = 0; c < n; c++) radek.push(q.isDark(r, c)); m.push(radek); }
    return m;
  }
  /* SVG s jednou cestou (vodorovné běhy tmavých modulů), tichá zóna 4 moduly dle ISO/IEC 18004. */
  function qrSvg(matice, okraj) {
    const n = matice.length, o = okraj == null ? 4 : okraj, vel = n + 2 * o;
    let d = '';
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!matice[r][c]) { c++; continue; }
        let k = c; while (k < n && matice[r][k]) k++;
        d += 'M' + (c + o) + ' ' + (r + o) + 'h' + (k - c) + 'v1h-' + (k - c) + 'z';
        c = k;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vel + ' ' + vel + '" shape-rendering="crispEdges" role="img" aria-label="QR kód">' +
      '<rect width="' + vel + '" height="' + vel + '" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
  }
  /* Rastr pro kontrolu dekódováním (RGBA), měřítko px/modul. */
  function qrRgba(matice, meritko, okraj) {
    const n = matice.length, o = okraj == null ? 4 : okraj, s = meritko || 4, w = (n + 2 * o) * s;
    const px = new Uint8ClampedArray(w * w * 4).fill(255);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (matice[r][c])
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const i = (((r + o) * s + y) * w + (c + o) * s + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
    return { data: px, width: w, height: w };
  }

  const API = { ARCHY, rozloz, qrMatice, qrSvg, qrRgba };
  if (typeof module !== 'undefined') module.exports = API; else window.MajetekStitky = API;
})();
