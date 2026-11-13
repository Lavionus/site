/* Rozbočka VZT – jednoduché čárové grafy na plátně (rychlost a tlak po délce, ztráta podle délky přechodu).
   Jedna osa y na graf, čáry 2 px, recesivní mřížka, legenda jen u ≥ 2 řad a popisek na konci čáry,
   nápověda při najetí myší (svislý kurzor, hodnoty všech řad). Barvy z CSS proměnných stránky (--viz-1, --viz-2). */
(function () {
  'use strict';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmt = (x, d = 1) => (Number.isFinite(x) ? (Math.round(x * 10 ** d) / 10 ** d).toLocaleString(document.documentElement.lang === 'cs' ? 'cs-CZ' : undefined, { maximumFractionDigits: d }) : '–');

  /** Hezké dělení osy: kroky 1, 2, 5 × 10^n. */
  function delky(min, max, n = 5) {
    const roz = max - min || 1, krok0 = roz / n, mag = 10 ** Math.floor(Math.log10(krok0));
    const krok = [1, 2, 5, 10].map(k => k * mag).find(k => roz / k <= n) || 10 * mag;
    const a = Math.floor(min / krok) * krok, b = Math.ceil(max / krok) * krok, out = [];
    for (let v = a; v <= b + krok / 2; v += krok) out.push(Math.abs(v) < krok / 1e6 ? 0 : v);
    return out;
  }

  /** opts: {titul, jednotkaX, jednotkaY, desetinY, nula (vodorovná čára 0), zony: [{x0, x1, nazev}]}
     data: {x: [], rady: [{nazev, y: [], barva}], znacky: [{x, y, nazev}], svisle: [{x, nazev}]} */
  function vytvorGraf(el, opts, priNajeti) {
    const platno = el.querySelector('canvas'), g = platno.getContext('2d');
    let data = null, kurzor = null, okraj = null, meritko = null;
    function kresli() {
      const w = el.clientWidth, h = el.clientHeight, dpr = window.devicePixelRatio || 1;
      if (!w || !h) return;
      platno.width = Math.round(w * dpr); platno.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      if (!data || !data.x.length) return;
      const ink = css('--text'), muted = css('--text-muted'), mrizka = css('--border'), font = '11px system-ui, sans-serif';
      g.font = font;
      let ymin = Infinity, ymax = -Infinity;
      for (const r of data.rady) for (const v of r.y) if (Number.isFinite(v)) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); }
      if (opts.nula) { ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0); }
      if (data.ymax != null) ymax = Math.min(ymax, data.ymax);      // oříznutí (čáry mimo rozsah se uříznou)
      if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) return;     // žádná platná hodnota – nic nekreslit
      if (!(ymax > ymin)) { ymax = ymin + 1; }
      const ty = delky(ymin, ymax, 4), tx = delky(data.x[0], data.x[data.x.length - 1], Math.max(3, Math.floor(w / 90)));
      const sirY = Math.max(...ty.map(v => g.measureText(fmt(v, opts.desetinY ?? 1)).width)) + 10;
      const legendaVys = data.rady.length > 1 ? 16 : 0;
      okraj = { l: sirY + 4, r: data.rady.length > 1 ? 70 : 14, t: 18 + legendaVys, b: 22 };
      const x0 = data.x[0], x1 = data.x[data.x.length - 1], y0 = ty[0], y1 = ty[ty.length - 1];
      const X = x => okraj.l + (x - x0) / (x1 - x0 || 1) * (w - okraj.l - okraj.r);
      const Y = y => h - okraj.b - (y - y0) / (y1 - y0 || 1) * (h - okraj.t - okraj.b);
      meritko = { X, x0, x1, w, h };
      // titul
      g.fillStyle = ink; g.textAlign = 'left'; g.textBaseline = 'top';
      g.font = '600 11px system-ui, sans-serif'; g.fillText(`${opts.titul} (${opts.jednotkaY})`, 0, 0); g.font = font;
      // legenda (≥ 2 řady)
      if (data.rady.length > 1) {
        let lx = 0;
        for (const r of data.rady) {
          g.fillStyle = r.barva; g.fillRect(lx, 21, 12, 3);
          g.fillStyle = muted; g.fillText(r.nazev, lx + 16, 16);
          lx += 16 + g.measureText(r.nazev).width + 14;
        }
      }
      // zóny (vstup / přechod / vývody) – jen jemné předěly a popisky
      g.textBaseline = 'top';
      for (const z of opts.zony ? opts.zony(data) : []) {
        g.strokeStyle = mrizka; g.lineWidth = 1; g.setLineDash([3, 3]);
        for (const xx of [z.x0, z.x1]) { if (xx <= x0 || xx >= x1) continue; g.beginPath(); g.moveTo(X(xx) + 0.5, okraj.t); g.lineTo(X(xx) + 0.5, h - okraj.b); g.stroke(); }
        g.setLineDash([]);
        g.fillStyle = muted; g.textAlign = 'center';
        const sx = (X(Math.max(z.x0, x0)) + X(Math.min(z.x1, x1))) / 2;
        if (Math.abs(X(z.x1) - X(z.x0)) > g.measureText(z.nazev).width + 6) g.fillText(z.nazev, sx, okraj.t);
      }
      // mřížka a osy
      g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineWidth = 1;
      for (const v of ty) {
        g.strokeStyle = v === 0 && opts.nula ? css('--border-strong') : mrizka;
        g.beginPath(); g.moveTo(okraj.l, Math.round(Y(v)) + 0.5); g.lineTo(w - okraj.r, Math.round(Y(v)) + 0.5); g.stroke();
        g.fillStyle = muted; g.fillText(fmt(v, opts.desetinY ?? 1), okraj.l - 6, Y(v));
      }
      g.textAlign = 'center'; g.textBaseline = 'top';
      const mezX = w - 2 - g.measureText(opts.jednotkaX).width - 6;   // popisky osy nesmí vjet do jednotky
      for (const v of tx) {
        if (v < x0 || v > x1) continue;
        const t = fmt(v, 0); if (X(v) + g.measureText(t).width / 2 > mezX) continue;
        g.fillStyle = muted; g.fillText(t, X(v), h - okraj.b + 5);
      }
      g.textAlign = 'right'; g.fillText(opts.jednotkaX, w - 2, h - okraj.b + 5);
      // svislé čáry (např. zvolená délka)
      for (const s of data.svisle || []) {
        g.strokeStyle = ink; g.lineWidth = 1; g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(X(s.x) + 0.5, okraj.t); g.lineTo(X(s.x) + 0.5, h - okraj.b); g.stroke(); g.setLineDash([]);
        g.fillStyle = ink; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(s.nazev, X(s.x) + 4, okraj.t + 2);
      }
      // čáry (oříznuté na plochu grafu)
      g.save(); g.beginPath(); g.rect(okraj.l, okraj.t - 2, w - okraj.l - okraj.r, h - okraj.t - okraj.b + 4); g.clip();
      for (const r of data.rady) {
        g.strokeStyle = r.barva; g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath();
        r.y.forEach((v, i) => { if (i) g.lineTo(X(data.x[i]), Y(v)); else g.moveTo(X(data.x[i]), Y(v)); });
        g.stroke();
      }
      g.restore();
      for (const r of data.rady) {
        if (data.rady.length > 1) {   // popisek na konci čáry (text v inkoustu, barvu nese čárka)
          const yk = Y(r.y[r.y.length - 1]);
          g.fillStyle = r.barva; g.fillRect(w - okraj.r + 4, yk - 1, 8, 3);
          g.fillStyle = muted; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(r.kratce || r.nazev, w - okraj.r + 15, yk);
        }
      }
      // značky (body variant) – terč 8 px s kroužkem v barvě plochy
      // popisky značek: nad bodem, při srážce pod bodem, jinak vynechat (hodnotu ukáže nápověda)
      const obsazeno = [];
      const volne = (x, y, sir) => !obsazeno.some(o => x < o.x + o.w && x + sir > o.x && y < o.y + 13 && y + 13 > o.y);
      for (const z of data.znacky || []) {
        const px = X(z.x), py = Y(z.y);
        g.fillStyle = css('--bg-panel'); g.beginPath(); g.arc(px, py, 6, 0, 2 * Math.PI); g.fill();
        g.fillStyle = z.barva || data.rady[0].barva; g.beginPath(); g.arc(px, py, 4.5, 0, 2 * Math.PI); g.fill();
        const sir = g.measureText(z.nazev).width, lx = Math.min(w - okraj.r - sir, Math.max(okraj.l, px - sir / 2));
        g.fillStyle = ink; g.textAlign = 'left'; g.textBaseline = 'top';
        for (const ly of [py - 21, py + 8]) if (volne(lx, ly, sir) && ly > okraj.t - 4 && ly + 12 < h - okraj.b) { g.fillText(z.nazev, lx, ly); obsazeno.push({ x: lx - 3, y: ly, w: sir + 6 }); break; }
      }
      // kurzor
      if (kurzor != null) {
        const i = nejblizsi(kurzor), px = X(data.x[i]);
        g.strokeStyle = muted; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px + 0.5, okraj.t); g.lineTo(px + 0.5, h - okraj.b); g.stroke();
        for (const r of data.rady) {
          g.fillStyle = css('--bg-panel'); g.beginPath(); g.arc(px, Y(r.y[i]), 5, 0, 2 * Math.PI); g.fill();
          g.fillStyle = r.barva; g.beginPath(); g.arc(px, Y(r.y[i]), 3.5, 0, 2 * Math.PI); g.fill();
        }
      }
    }
    function nejblizsi(x) {
      let b = 0, d = Infinity;
      data.x.forEach((v, i) => { const e = Math.abs(v - x); if (e < d) { d = e; b = i; } });
      return b;
    }
    el.addEventListener('pointermove', e => {
      if (!data || !meritko) return;
      const r = el.getBoundingClientRect(), px = e.clientX - r.left;
      const x = meritko.x0 + (px - okraj.l) / (meritko.w - okraj.l - okraj.r) * (meritko.x1 - meritko.x0);
      if (x < meritko.x0 - 1e-9 || x > meritko.x1 + 1e-9) { priNajeti && priNajeti(null, e); return; }
      priNajeti && priNajeti(data.x[nejblizsi(x)], e);
    });
    el.addEventListener('pointerleave', e => priNajeti && priNajeti(null, e));
    new ResizeObserver(() => kresli()).observe(el);
    return {
      nastav(d) { data = d; kresli(); },
      kurzor(x) { kurzor = x; kresli(); },
      hodnoty(x) { if (!data) return null; const i = nejblizsi(x); return { x: data.x[i], rady: data.rady.map(r => ({ nazev: r.nazev, barva: r.barva, y: r.y[i] })) }; },
      kresli,
    };
  }
  window.ROZB_VZT_GRAFY = { vytvorGraf, fmt };
})();
