/* Vstupenky – kreslení jednoho kusu na plátno (náhled, tisk i PDF používají totéž).
   Souřadnice projektu jsou v mm, plátno se škáluje parametrem pxMm. Vyžaduje VSTUPENKY a qrcode (lib/qrcode). */
(function () {
  'use strict';
  const V = window.VSTUPENKY;
  const PISMA = {
    sans: 'Arial, "Liberation Sans", Helvetica, sans-serif',
    serif: 'Georgia, "Liberation Serif", "Times New Roman", serif',
    kondenz: '"Arial Narrow", "Liberation Sans Narrow", "Roboto Condensed", sans-serif',
    mono: '"Liberation Mono", Consolas, "Courier New", monospace',
  };
  const PT = 25.4 / 72;   // 1 pt v mm

  // obrázky z dataURL – načtené jednou, pak z mezipaměti
  const obrazky = new Map();
  function obrazek(url) {
    if (!url) return null;
    let o = obrazky.get(url);
    if (!o) {
      o = new Image();
      o.src = url;
      obrazky.set(url, o);
    }
    return o.complete && o.naturalWidth ? o : null;
  }
  function nactiObrazky(projekt) {
    const url = [projekt.logo, projekt.pozadi && projekt.pozadi.obrazek].filter(Boolean);
    return Promise.all(url.map(u => new Promise(hotovo => {
      const o = obrazky.get(u) || (obrazek(u), obrazky.get(u));
      if (o.complete) return hotovo();
      o.onload = o.onerror = () => hotovo();
    })));
  }

  // text QR podle nastavení
  function textQr(projekt, prom) {
    const q = projekt.qr || {};
    if (q.obsah === 'url') return prom.url || prom.kod;
    if (q.obsah === 'vlastni') return V.doplnText(q.url || '{kod}', prom);
    return prom.kod;
  }

  const qrCache = new Map();
  function qrMatice(text) {
    let m = qrCache.get(text);
    if (m) return m;
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    m = { n, tmavy: (r, c) => q.isDark(r, c) };
    if (qrCache.size > 400) qrCache.clear();
    qrCache.set(text, m);
    return m;
  }

  // oblast → obdélník v mm
  function oblast(obl, nazev) { return (nazev === 'ustrizek' && obl.ustrizek) ? obl.ustrizek : obl.hlavni; }

  /* Nakreslí kus na ctx v mm měřítku pxMm (počátek 0,0).
     volby.boxy = [] → doplní obdélníky prvků pro tažení myší: {druh, i, x, y, w, h} v mm.
     volby.vybrany = {druh, i} – zvýrazní vybraný prvek (jen náhled). */
  function kresliKus(ctx, projekt, kus, pxMm, volby) {
    volby = volby || {};
    const W = +projekt.rozmer.w, H = +projekt.rozmer.h;
    const obl = V.oblasti(projekt);
    const prom = kus.promenne;
    const barvaT = projekt.barvaTextu || '#000000';
    const rodina = PISMA[projekt.pismo] || PISMA.sans;
    ctx.save();
    ctx.scale(pxMm, pxMm);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // pozadí
    const pz = projekt.pozadi || {};
    ctx.fillStyle = pz.barva1 || '#ffffff';
    if (pz.druh === 'prechod') {
      const u = (+pz.uhel || 0) * Math.PI / 180, dx = Math.cos(u), dy = Math.sin(u);
      const d = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
      const g = ctx.createLinearGradient(W / 2 - dx * d, H / 2 - dy * d, W / 2 + dx * d, H / 2 + dy * d);
      g.addColorStop(0, pz.barva1 || '#ffffff'); g.addColorStop(1, pz.barva2 || '#dddddd');
      ctx.fillStyle = g;
    }
    ctx.fillRect(0, 0, W, H);
    const op = pz.druh === 'obrazek' ? obrazek(pz.obrazek) : null;
    if (op) {
      const s = Math.max(W / op.naturalWidth, H / op.naturalHeight), w = op.naturalWidth * s, h = op.naturalHeight * s;
      ctx.drawImage(op, (W - w) / 2, (H - h) / 2, w, h);
      if (+pz.zakryti > 0) { ctx.fillStyle = `rgba(0,0,0,${(+pz.zakryti) / 100})`; ctx.fillRect(0, 0, W, H); }
    }
    // ústřižek mírně odlišený
    if (obl.ustrizek) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(obl.ustrizek.x, obl.ustrizek.y, obl.ustrizek.w, obl.ustrizek.h);
    }
    // rámeček
    ctx.strokeStyle = barvaT; ctx.lineWidth = 0.35;
    if (projekt.ramecek) {
      ctx.globalAlpha = 0.55;
      for (const o of [obl.hlavni, obl.ustrizek].filter(Boolean)) {
        const m = Math.min(2.5, Math.min(o.w, o.h) * 0.06);
        ctx.strokeRect(o.x + m, o.y + m, o.w - 2 * m, o.h - 2 * m);
      }
      ctx.globalAlpha = 1;
    }
    // perforace
    if (projekt.perforace && obl.perforace) {
      const p = obl.perforace;
      ctx.save();
      ctx.setLineDash([1.6, 1.2]); ctx.lineWidth = 0.35; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = barvaT; ctx.font = `3.2px ${rodina}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (p.x1 === p.x2) { ctx.save(); ctx.translate(p.x1, Math.min(4, H / 6)); ctx.rotate(Math.PI / 2); ctx.fillText('✂', 0, 0); ctx.restore(); }
      else ctx.fillText('✂', Math.min(4, W / 6), p.y1);
    }
    // logo
    const lg = projekt.logo ? obrazek(projekt.logo) : null;
    if (lg) {
      const lp = projekt.logoPozice, o = oblast(obl, lp.oblast);
      const w = +lp.mm || 15, h = w * lg.naturalHeight / lg.naturalWidth;
      const x = o.x + o.w * lp.x / 100 - w / 2, y = o.y + o.h * lp.y / 100 - h / 2;
      ctx.drawImage(lg, x, y, w, h);
      if (volby.boxy) volby.boxy.push({ druh: 'logo', x, y, w, h });
    }
    // texty
    (projekt.prvky || []).forEach((pr, i) => {
      if (pr.oblast === 'ustrizek' && !obl.ustrizek) return;
      const o = oblast(obl, pr.oblast);
      const text = V.doplnText(pr.text, prom);
      if (!text.trim()) return;
      let vel = (+pr.pt || 10) * PT;
      ctx.font = `${pr.tucne ? 'bold ' : ''}${vel}px ${rodina}`;
      // příliš dlouhý text se zmenší, aby nepřetekl oblast
      const x = o.x + o.w * pr.x / 100, y = o.y + o.h * pr.y / 100;
      const volno = pr.zarovnani === 'c' ? 2 * Math.min(x - o.x, o.x + o.w - x) : pr.zarovnani === 'r' ? x - o.x : o.x + o.w - x;
      let sirka = ctx.measureText(text).width;
      const max = Math.max(4, volno - 1.5);
      if (sirka > max) { vel *= max / sirka; ctx.font = `${pr.tucne ? 'bold ' : ''}${vel}px ${rodina}`; sirka = max; }
      ctx.fillStyle = pr.barva || barvaT;
      ctx.textAlign = pr.zarovnani === 'c' ? 'center' : pr.zarovnani === 'r' ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
      const bx = pr.zarovnani === 'c' ? x - sirka / 2 : pr.zarovnani === 'r' ? x - sirka : x;
      if (volby.boxy) volby.boxy.push({ druh: 'prvek', i, x: bx, y: y - vel / 2, w: sirka, h: vel });
    });
    // QR
    const q = projekt.qr;
    if (q && q.zapnuto && (q.oblast !== 'ustrizek' || obl.ustrizek)) {
      const o = oblast(obl, q.oblast), text = textQr(projekt, prom);
      if (text) {
        const m = qrMatice(text), s = +q.mm || 20, mod = s / (m.n + 2);
        const x = o.x + o.w * q.x / 100 - s / 2, y = o.y + o.h * q.y / 100 - s / 2;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, s, s);
        ctx.fillStyle = '#000000';
        for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++)
          if (m.tmavy(r, c)) ctx.fillRect(x + (c + 1) * mod, y + (r + 1) * mod, mod + 0.01, mod + 0.01);
        if (volby.boxy) volby.boxy.push({ druh: 'qr', x, y, w: s, h: s });
      }
    }
    // Code 128
    const cb = projekt.carovy;
    if (cb && cb.zapnuto && (cb.oblast !== 'ustrizek' || obl.ustrizek)) {
      const o = oblast(obl, cb.oblast), text = V.doplnText(cb.obsah || '{kod}', prom);
      let moduly = null;
      try { moduly = V.code128(text); } catch (e) { moduly = null; }
      const w = +cb.w || 40, h = +cb.h || 8;
      const x = o.x + o.w * cb.x / 100 - w / 2, y = o.y + o.h * cb.y / 100 - h / 2;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h);
      if (moduly) {
        const mod = w / (moduly.length + 20);
        ctx.fillStyle = '#000000';
        for (let i = 0; i < moduly.length; i++) if (moduly[i] === '1') ctx.fillRect(x + (10 + i) * mod, y + 0.6, mod + 0.005, h - 1.2);
      } else {
        ctx.fillStyle = '#c00'; ctx.font = `2.5px ${rodina}`; ctx.textAlign = 'center'; ctx.fillText('Code 128: nepovolené znaky', x + w / 2, y + h / 2);
      }
      if (volby.boxy) volby.boxy.push({ druh: 'carovy', x, y, w, h });
    }
    // zvýraznění vybraného prvku
    if (volby.vybrany && volby.boxy) {
      const b = volby.boxy.find(b => b.druh === volby.vybrany.druh && (b.druh !== 'prvek' || b.i === volby.vybrany.i));
      if (b) {
        ctx.save(); ctx.setLineDash([1, 0.8]); ctx.lineWidth = 0.3; ctx.strokeStyle = '#1e90ff';
        ctx.strokeRect(b.x - 0.6, b.y - 0.6, b.w + 1.2, b.h + 1.2); ctx.restore();
      }
    }
    ctx.restore();
  }

  /* kus jako samostatné plátno v daném DPI; otocit = o 90° (rozložení na arch) */
  function kusNaPlatno(projekt, kus, dpi, otocit) {
    const pxMm = dpi / 25.4;
    const W = +projekt.rozmer.w, H = +projekt.rozmer.h;
    const c = document.createElement('canvas');
    c.width = Math.round((otocit ? H : W) * pxMm); c.height = Math.round((otocit ? W : H) * pxMm);
    const ctx = c.getContext('2d');
    if (otocit) { ctx.translate(c.width, 0); ctx.rotate(Math.PI / 2); }
    kresliKus(ctx, projekt, kus, pxMm);
    return c;
  }

  window.VSTUPENKY_KRESLI = { kresliKus, kusNaPlatno, nactiObrazky, textQr, PISMA };
})();
