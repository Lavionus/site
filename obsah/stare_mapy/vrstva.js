/* Staré mapy – vrstva Leafletu, která převzorkuje dlaždice WMTS v S-JTSK (EPSG:5514)
   do Web Mercatoru. Pro každou dlaždici 256 px spočte mřížku 9×9 bodů v S-JTSK (STMAPY),
   stáhne potřebné zdrojové dlaždice (CORS), složí je a pixel po pixelu přemapuje
   (bilineární interpolace souřadnic, nejbližší soused v obraze). */
(function () {
  'use strict';
  const KROK = 8, MAX_ZDROJU = 16;
  const cache = new Map();                 // url → Promise<HTMLImageElement|null>

  function nacti(url) {
    if (cache.has(url)) { const p = cache.get(url); cache.delete(url); cache.set(url, p); return p; }
    const p = new Promise(ok => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => ok(img);
      img.onerror = () => { cache.delete(url); ok(null); };
      img.src = url;
    });
    cache.set(url, p);
    if (cache.size > 120) cache.delete(cache.keys().next().value);
    return p;
  }

  L.GridLayer.Jtsk = L.GridLayer.extend({
    options: { tileSize: 256, updateWhenZooming: false, keepBuffer: 1 },

    createTile(k, done) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      this._vykresli(c, k).then(() => done(null, c), e => done(e, c));
      return c;
    },

    async _vykresli(c, k) {
      const o = this.options, S = window.STMAPY;
      const m = S.mrizkaDlazdice(k.z, k.x, k.y, KROK);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < m.length; i += 2) {
        x0 = Math.min(x0, m[i]); x1 = Math.max(x1, m[i]); y0 = Math.min(y0, m[i + 1]); y1 = Math.max(y1, m[i + 1]);
      }
      const res = Math.hypot(m[2 * KROK] - m[0], m[2 * KROK + 1] - m[1]) / 256;
      const u = o.urovne[S.vyberUroven(o.urovne, res, o.maxUroven)];
      const d = S.dlazdiceObdelniku(u, [x0, y0, x1, y1]);
      if (!d.pocet) return;
      if (d.pocet > MAX_ZDROJU) throw new Error('příliš mnoho zdrojových dlaždic');
      const W = (d.c1 - d.c0 + 1) * u.tw, H = (d.r1 - d.r0 + 1) * u.th;
      const mos = document.createElement('canvas');
      mos.width = W; mos.height = H;
      const mc = mos.getContext('2d', { willReadFrequently: true });
      const ukoly = [];
      for (let r = d.r0; r <= d.r1; r++) for (let s = d.c0; s <= d.c1; s++) {
        const url = S.urlDlazdice(o.sablona, { sada: o.sada, uroven: u.id, radek: r, sloupec: s, styl: o.styl });
        ukoly.push(nacti(url).then(img => { if (img) mc.drawImage(img, (s - d.c0) * u.tw, (r - d.r0) * u.th); return !!img; }));
      }
      const vysl = await Promise.all(ukoly);
      if (!vysl.some(Boolean)) throw new Error('zdrojové dlaždice se nenačetly');
      const src = mc.getImageData(0, 0, W, H).data;
      const ox = u.x0 + d.c0 * u.tw * u.rozliseni, oy = u.y0 - d.r0 * u.th * u.rozliseni, ir = 1 / u.rozliseni;
      const ctx = c.getContext('2d');
      const out = ctx.createImageData(256, 256), od = out.data;
      const krokPx = 256 / KROK, R = KROK + 1;
      for (let py = 0; py < 256; py++) {
        const gy = (py + 0.5) / krokPx, j = Math.min(KROK - 1, gy | 0), fy = gy - j;
        for (let px = 0; px < 256; px++) {
          const gx = (px + 0.5) / krokPx, i = Math.min(KROK - 1, gx | 0), fx = gx - i;
          const a = (j * R + i) * 2, b = a + 2, cc = a + R * 2, dd = cc + 2;
          const X = (m[a] * (1 - fx) + m[b] * fx) * (1 - fy) + (m[cc] * (1 - fx) + m[dd] * fx) * fy;
          const Y = (m[a + 1] * (1 - fx) + m[b + 1] * fx) * (1 - fy) + (m[cc + 1] * (1 - fx) + m[dd + 1] * fx) * fy;
          const sx = ((X - ox) * ir) | 0, sy = ((oy - Y) * ir) | 0;
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
          const si = (sy * W + sx) * 4, oi = (py * 256 + px) * 4;
          od[oi] = src[si]; od[oi + 1] = src[si + 1]; od[oi + 2] = src[si + 2]; od[oi + 3] = src[si + 3];
        }
      }
      ctx.putImageData(out, 0, 0);
    }
  });
  L.gridLayer.jtsk = o => new L.GridLayer.Jtsk(o);
})();
