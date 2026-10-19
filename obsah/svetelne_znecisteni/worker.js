/* worker.js – výpočet pole jasu a odhadu bodu mimo hlavní vlákno.
   Zprávy: {id, typ:'pole'|'bod', vrstvy:[Uint8Array|null], w, h, px, ...}
   Výsledek: {id, ok, ...} */
importScripts('jadro.js');
const J = self.SZ_JADRO;
self.onmessage = e => {
  const z = e.data;
  try {
    const { r, bezDat, saturovano } = J.medianRadiance(z.vrstvy, z.w * z.h);
    if (z.typ === 'pole') {
      const pole = J.poleUmelehoJasu(r, z.w, z.h, z.px);
      const v = J.orizni(pole, z.w, z.x0, z.y0, z.sw, z.sh);
      self.postMessage({ id: z.id, ok: true, pole: v, bezDat: bezDat / (z.w * z.h) }, [v.buffer]);
    } else {
      const b = J.umelyJasBodu(r, z.w, z.h, z.cx, z.cy, z.px);
      // saturace a chybějící data jen v okolí 10 km (relevantní pro varování)
      let sat = 0, chybi = 0, n = 0;
      const rp = Math.ceil(10 / z.px);
      for (let y = Math.max(0, Math.floor(z.cy - rp)); y < Math.min(z.h, z.cy + rp); y++)
        for (let x = Math.max(0, Math.floor(z.cx - rp)); x < Math.min(z.w, z.cx + rp); x++) {
          n++;
          let ma = false, s = 0;
          for (const a of z.vrstvy) if (a && a[y * z.w + x]) { ma = true; if (a[y * z.w + x] === 255) s++; }
          if (!ma) chybi++; else if (s * 2 >= z.vrstvy.filter(Boolean).length) sat++;
        }
      self.postMessage({ id: z.id, ok: true, mcd: b.mcd, podilDo10km: b.podilDo10km, satOkoli: sat / Math.max(1, n), chybiOkoli: chybi / Math.max(1, n), bezDat: bezDat / (z.w * z.h), saturovano });
    }
  } catch (err) {
    self.postMessage({ id: z.id, ok: false, chyba: String(err && err.message || err) });
  }
};
