/* evoluce/grafy.js – jednoduché grafy na plátně (respektují devicePixelRatio a barvy tématu). */
(function () {
  'use strict';

  function css(nazev, zaloha) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nazev).trim();
    return v || zaloha;
  }
  function cislo(x, des) {
    if (!Number.isFinite(x)) return '–';
    return x.toFixed(des).replace('.', ',').replace('-', '−');
  }
  /** Připraví plátno: CSS rozměr z kontejneru, pixelový × DPR. Vrací {g, w, h}. */
  function priprav(cv, vyskaCss) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(50, Math.floor(cv.clientWidth || cv.parentElement.clientWidth));
    const h = vyskaCss || Math.floor(cv.clientHeight) || 180;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }
  function pekneKroky(min, max, n) {
    const rozsah = max - min || 1, hrubo = rozsah / n;
    const mag = Math.pow(10, Math.floor(Math.log10(hrubo)));
    const k = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= hrubo) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(min / k) * k; v <= max + k * 1e-9; v += k) out.push(v);
    return { hodnoty: out, krok: k };
  }
  function desetin(krok) { return krok >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(krok))); }

  /** Osy a mřížka. Vrací převody souřadnic. */
  function osy(g, w, h, xmin, xmax, ymin, ymax, popisY, popisX) {
    const L = 46, R = 10, T = 10, B = 24;
    const sx = x => L + (x - xmin) / ((xmax - xmin) || 1) * (w - L - R);
    const sy = y => h - B - (y - ymin) / ((ymax - ymin) || 1) * (h - T - B);
    const zx = X => xmin + (X - L) / ((w - L - R) || 1) * (xmax - xmin);
    const zy = Y => ymin + (h - B - Y) / ((h - T - B) || 1) * (ymax - ymin);
    g.font = '11px ' + css('--font', 'sans-serif');
    g.strokeStyle = css('--border', '#444'); g.fillStyle = css('--text-muted', '#aaa');
    g.lineWidth = 1;
    const py = pekneKroky(ymin, ymax, 4), dy = desetin(py.krok);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const v of py.hodnoty) {
      const y = Math.round(sy(v)) + 0.5;
      g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke();
      g.fillText(cislo(v, dy), L - 5, y);
    }
    const px = pekneKroky(xmin, xmax, Math.max(2, Math.floor((w - L - R) / 70)));
    g.textAlign = 'center'; g.textBaseline = 'top';
    const dx = desetin(px.krok);
    for (const v of px.hodnoty) {
      const x = Math.round(sx(v)) + 0.5;
      g.beginPath(); g.moveTo(x, h - B); g.lineTo(x, h - B + 4); g.stroke();
      g.fillText(v >= 10000 ? cislo(v / 1000, v % 1000 ? 1 : 0) + ' tis.' : cislo(v, dx), x, h - B + 6);
    }
    g.strokeStyle = css('--border-strong', '#555');
    g.beginPath(); g.moveTo(L + 0.5, T); g.lineTo(L + 0.5, h - B + 0.5); g.lineTo(w - R, h - B + 0.5); g.stroke();
    if (popisY) { g.save(); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(popisY, L + 4, T); g.restore(); }
    if (popisX) { g.save(); g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(popisX, w - R - 2, h - B - 3); g.restore(); }
    return { sx, sy, zx, zy, L, R, T, B, xmin, xmax, ymin, ymax, dy, dx };
  }
  function svisle(g, o, h, xs, barva) {
    g.save(); g.strokeStyle = barva; g.setLineDash([4, 3]); g.lineWidth = 1;
    for (const x of xs) { const X = Math.round(o.sx(x)) + 0.5; g.beginPath(); g.moveTo(X, o.T); g.lineTo(X, h - o.B); g.stroke(); }
    g.restore();
  }

  /**
   * Čárový graf. serie: [{body:[[x,y]], barva, tloustka, carkovane, pas:[[x,lo,hi]], chyby:[[x,lo,hi]], znacky, nazev, des}]
   * volby: {ymin, ymax, popisY, popisX, udalosti:[x], formatX(x)}
   * Pod kurzorem ukáže hodnoty všech pojmenovaných řad v nejbližším x.
   */
  function cary(cv, serie, volby) {
    volby = volby || {};
    const { g, w, h } = priprav(cv);
    let xmin = Infinity, xmax = -Infinity, ymin = volby.ymin, ymax = volby.ymax;
    let ymn = Infinity, ymx = -Infinity;
    for (const s of serie) for (const b of s.body) {
      if (b[0] < xmin) xmin = b[0]; if (b[0] > xmax) xmax = b[0];
      if (b[1] < ymn) ymn = b[1]; if (b[1] > ymx) ymx = b[1];
    }
    if (!Number.isFinite(xmin)) { xmin = 0; xmax = 1; }
    if (xmax === xmin) xmax = xmin + 1;
    if (ymin === undefined) ymin = Math.min(0, ymn);
    if (ymax === undefined) ymax = Number.isFinite(ymx) ? Math.max(ymx * 1.08, ymin + 1e-6) : 1;
    if (ymax <= ymin) ymax = ymin + 1;
    for (const s of serie) if (s.chyby) for (const b of s.chyby) { if (b[2] > ymax && volby.ymax === undefined) ymax = b[2] * 1.05; }
    const o = osy(g, w, h, xmin, xmax, ymin, ymax, volby.popisY, volby.popisX);
    if (volby.udalosti && volby.udalosti.length) svisle(g, o, h, volby.udalosti.filter(x => x >= xmin && x <= xmax), css('--danger', '#e55'));
    g.save();
    g.beginPath(); g.rect(o.L, o.T - 2, w - o.L - o.R, h - o.T - o.B + 2); g.clip();
    for (const s of serie) {
      if (s.pas && s.pas.length) {
        g.fillStyle = s.barva; g.globalAlpha = 0.18; g.beginPath();
        s.pas.forEach((b, i) => { const X = o.sx(b[0]), Y = o.sy(b[2]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        for (let i = s.pas.length - 1; i >= 0; i--) g.lineTo(o.sx(s.pas[i][0]), o.sy(s.pas[i][1]));
        g.closePath(); g.fill(); g.globalAlpha = 1;
      }
      g.strokeStyle = s.barva; g.lineWidth = s.tloustka || 1.8; g.setLineDash(s.carkovane ? [5, 4] : []);
      g.lineJoin = 'round';
      g.beginPath();
      s.body.forEach((b, i) => { const X = o.sx(b[0]), Y = o.sy(b[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.stroke();
      g.setLineDash([]);
      if (s.chyby) {
        g.lineWidth = 1.2;
        for (const b of s.chyby) {
          if (!Number.isFinite(b[1]) || !Number.isFinite(b[2])) continue;
          const X = o.sx(b[0]), Y1 = o.sy(b[1]), Y2 = o.sy(b[2]);
          g.beginPath(); g.moveTo(X, Y1); g.lineTo(X, Y2); g.moveTo(X - 4, Y1); g.lineTo(X + 4, Y1); g.moveTo(X - 4, Y2); g.lineTo(X + 4, Y2); g.stroke();
        }
      }
      if (s.znacky) {
        g.fillStyle = s.barva;
        for (const b of s.body) { g.beginPath(); g.arc(o.sx(b[0]), o.sy(b[1]), 3.2, 0, 2 * Math.PI); g.fill(); }
      }
    }
    g.restore();
    const fx = volby.formatX || (x => cislo(x, o.dx));
    cv._tip = X => {
      const xv = o.zx(X);
      let nejX = null, nejD = Infinity;
      for (const s of serie) if (s.nazev) for (const b of s.body) { const d = Math.abs(b[0] - xv); if (d < nejD) { nejD = d; nejX = b[0]; } }
      if (nejX === null) return null;
      const radky = [];
      for (const s of serie) {
        if (!s.nazev) continue;
        const b = s.body.find(q => q[0] === nejX);
        if (!b) continue;
        const ch = s.chyby && s.chyby.find(q => q[0] === nejX);
        const pas = s.pas && s.pas.find(q => q[0] === nejX);
        const des = s.des !== undefined ? s.des : Math.max(o.dy, 1) + 1;
        let t = cislo(b[1], des);
        if (ch && Number.isFinite(ch[2])) t += ' ± ' + cislo((ch[2] - ch[1]) / 2, des);
        else if (pas && Number.isFinite(pas[2])) t += ' (' + cislo(pas[1], des) + ' – ' + cislo(pas[2], des) + ')';
        radky.push({ barva: s.barva, text: s.nazev + ': ' + t });
      }
      return { x: o.sx(nejX), titul: fx(nejX), radky };
    };
    pripojTip(cv);
  }

  /* ---------- čtení hodnot pod kurzorem ---------- */
  function pripojTip(cv) {
    if (cv._tipPripojen) return;
    cv._tipPripojen = true;
    const rod = cv.parentElement;
    const box = document.createElement('div'); box.className = 'graf-tip'; box.hidden = true;
    const cara = document.createElement('div'); cara.className = 'graf-cara'; cara.hidden = true;
    rod.appendChild(cara); rod.appendChild(box);
    const skryj = () => { box.hidden = true; cara.hidden = true; };
    cv.addEventListener('pointermove', e => {
      if (!cv._tip) return skryj();
      const r = cv.getBoundingClientRect();
      const t = cv._tip(e.clientX - r.left, e.clientY - r.top);
      if (!t || !t.radky.length) return skryj();
      box.innerHTML = `<b>${esc(t.titul)}</b>` + t.radky.map(q => `<div><i style="background:${q.barva}"></i>${esc(q.text)}</div>`).join('');
      box.hidden = false;
      const levo = cv.offsetLeft + t.x, horni = cv.offsetTop;
      cara.hidden = t.bez_cary === true;
      cara.style.left = Math.round(levo) + 'px'; cara.style.top = horni + 'px'; cara.style.height = cv.clientHeight + 'px';
      const bw = box.offsetWidth;
      let x = levo + 12;
      if (x + bw > rod.clientWidth) x = levo - 12 - bw;
      box.style.left = Math.max(0, x) + 'px';
      box.style.top = (horni + 6) + 'px';
    });
    cv.addEventListener('pointerleave', skryj);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /**
   * Bodový graf (morfoprostor). body: [{x, y, barva, r, id}]
   * volby: {xmin, xmax, ymin, ymax, popisX, popisY, stopa:[[x,y]], vybrany:id, barvaStopy, formatX, formatY}
   * Vrací převody souřadnic; pod kurzorem ukáže nejbližší bod.
   */
  function bodovy(cv, body, volby) {
    const { g, w, h } = priprav(cv);
    const o = osy(g, w, h, volby.xmin, volby.xmax, volby.ymin, volby.ymax, volby.popisY, volby.popisX);
    g.save();
    g.beginPath(); g.rect(o.L, o.T - 2, w - o.L - o.R, h - o.T - o.B + 2); g.clip();
    const tma = css('--bg-deep', '#000');
    g.lineWidth = 0.6; g.strokeStyle = tma;
    for (const b of body) {
      g.fillStyle = b.barva; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(o.sx(b.x), o.sy(b.y), b.r || 3, 0, 2 * Math.PI); g.fill(); g.stroke();
    }
    g.globalAlpha = 1;
    if (volby.stopa && volby.stopa.length > 1) {
      g.strokeStyle = volby.barvaStopy || css('--text', '#ddd'); g.lineWidth = 1.6; g.setLineDash([]);
      g.beginPath();
      volby.stopa.forEach((b, i) => { const X = o.sx(b[0]), Y = o.sy(b[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.stroke();
      const k = volby.stopa[volby.stopa.length - 1];
      g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(o.sx(k[0]), o.sy(k[1]), 4, 0, 2 * Math.PI); g.fill();
      const z = volby.stopa[0];
      g.beginPath(); g.arc(o.sx(z[0]), o.sy(z[1]), 4, 0, 2 * Math.PI); g.lineWidth = 1.6; g.stroke();
    }
    const vyb = volby.vybrany ? body.find(b => b.id === volby.vybrany) : null;
    if (vyb) {
      g.strokeStyle = css('--text', '#ddd'); g.lineWidth = 2;
      g.beginPath(); g.arc(o.sx(vyb.x), o.sy(vyb.y), (vyb.r || 3) + 4, 0, 2 * Math.PI); g.stroke();
    }
    g.restore();
    const fx = volby.formatX || (x => cislo(x, 2)), fy = volby.formatY || (y => cislo(y, 2));
    o.nejblizsi = (X, Y, max) => {
      let best = null, bd = (max || 14) ** 2;
      for (const b of body) { const d = (o.sx(b.x) - X) ** 2 + (o.sy(b.y) - Y) ** 2; if (d < bd) { bd = d; best = b; } }
      return best;
    };
    cv._tip = (X, Y) => {
      const b = o.nejblizsi(X, Y);
      if (!b) return null;
      return { x: o.sx(b.x), bez_cary: true, titul: b.titulek || ('#' + b.id), radky: [{ barva: b.barva, text: (volby.popisX || 'x') + ': ' + fx(b.x) }, { barva: b.barva, text: (volby.popisY || 'y') + ': ' + fy(b.y) }] };
    };
    pripojTip(cv);
    return o;
  }

  /** Stáhne plátno jako PNG (s neprůhledným pozadím tématu). */
  function stahniPng(cv, nazev) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const g = c.getContext('2d');
    g.fillStyle = css('--bg-panel', '#fff'); g.fillRect(0, 0, c.width, c.height);
    g.drawImage(cv, 0, 0);
    c.toBlob(b => {
      if (!b) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nazev;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  /** Teplotní mapa četností: sloupce = čas, řádky = biny hodnot znaku. */
  function mapa(cv, body, gi, gen, volby) {
    volby = volby || {};
    const { g, w, h } = priprav(cv);
    const xmin = body.length ? body[0].t : 0, xmax = body.length > 1 ? body[body.length - 1].t : xmin + 1;
    const o = osy(g, w, h, xmin, xmax, gen.min, gen.max, volby.popisY);
    if (!body.length) return;
    const biny = body[0].hist[gi].length;
    const r = css('--accent', '#6aa6fd');
    const sirka = (w - o.L - o.R) / Math.max(1, body.length - 1);
    const vyskaBinu = (h - o.T - o.B) / biny;
    g.fillStyle = r;
    for (let k = 0; k < body.length; k++) {
      const b = body[k];
      const x = body.length > 1 ? o.sx(b.t) - sirka / 2 : o.L;
      let maxB = 0; for (const c of b.hist[gi]) if (c > maxB) maxB = c;
      for (let j = 0; j < biny; j++) {
        const c = b.hist[gi][j];
        if (!c) continue;
        g.globalAlpha = Math.min(1, 0.08 + 0.92 * c / maxB);
        const y = h - o.B - (j + 1) * vyskaBinu;
        g.fillRect(Math.max(o.L, x), y, Math.max(1, sirka + 0.6), vyskaBinu + 0.4);
      }
    }
    g.globalAlpha = 1;
    // průměr
    g.strokeStyle = css('--text', '#ddd'); g.lineWidth = 1.4; g.setLineDash([]);
    g.beginPath();
    body.forEach((b, i) => { if (!b.n) return; const X = o.sx(b.t), Y = o.sy(b.prum[gi]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.stroke();
    if (volby.udalosti) svisle(g, o, h, volby.udalosti.filter(x => x >= xmin && x <= xmax), css('--danger', '#e55'));
    cv._tip = (X, Y) => {
      const xv = o.zx(X), yv = o.zy(Y);
      let k = 0, bd = Infinity;
      body.forEach((b, i) => { const d = Math.abs(b.t - xv); if (d < bd) { bd = d; k = i; } });
      const b = body[k];
      const j = Math.max(0, Math.min(biny - 1, Math.floor((yv - gen.min) / (gen.max - gen.min) * biny)));
      const od = gen.min + (gen.max - gen.min) * j / biny, do_ = gen.min + (gen.max - gen.min) * (j + 1) / biny;
      const des = gen.des !== undefined ? gen.des : 2;
      return { x: o.sx(b.t), titul: 'krok ' + cislo(b.t, 0), radky: [
        { barva: r, text: `${cislo(od, des)} – ${cislo(do_, des)}: ${b.hist[gi][j]} jedinců z ${b.n}` },
        { barva: css('--text', '#ddd'), text: 'průměr ' + cislo(b.prum[gi], des + 1) },
      ] };
    };
    pripojTip(cv);
  }

  /** Sloupcový histogram aktuální populace. */
  function sloupce(cv, hodnoty, gen, barvaFn) {
    const { g, w, h } = priprav(cv);
    const max = Math.max(1, ...hodnoty);
    const o = osy(g, w, h, gen.min, gen.max, 0, max * 1.1, 'počet');
    const n = hodnoty.length, krok = (gen.max - gen.min) / n;
    for (let j = 0; j < n; j++) {
      const x0 = o.sx(gen.min + j * krok) + 1, x1 = o.sx(gen.min + (j + 1) * krok) - 1;
      const y = o.sy(hodnoty[j]);
      g.fillStyle = barvaFn ? barvaFn(gen.min + (j + 0.5) * krok) : css('--accent', '#6aa6fd');
      g.fillRect(x0, y, Math.max(1, x1 - x0), h - o.B - y);
    }
    const des = gen.des !== undefined ? gen.des : 2;
    cv._tip = X => {
      const j = Math.floor((o.zx(X) - gen.min) / krok);
      if (j < 0 || j >= n) return null;
      const celk = hodnoty.reduce((a, b) => a + b, 0);
      return { x: o.sx(gen.min + (j + 0.5) * krok), titul: `${cislo(gen.min + j * krok, des)} – ${cislo(gen.min + (j + 1) * krok, des)}`,
        radky: [{ barva: css('--accent', '#6aa6fd'), text: `${hodnoty[j]} jedinců (${cislo(celk ? hodnoty[j] / celk * 100 : 0, 1)} %)` }] };
    };
    pripojTip(cv);
  }

  /** Sloupce s chybovými úsečkami nad intervaly [od, do] (profil fitness). data: [{od, do, y, lo, hi, popis}] */
  function intervaly(cv, data, volby) {
    volby = volby || {};
    const { g, w, h } = priprav(cv);
    const ok = data.filter(d => Number.isFinite(d.y));
    const xmin = data.length ? data[0].od : 0, xmax = data.length ? data[data.length - 1].do : 1;
    let ymax = volby.ymax || 0;
    for (const d of ok) ymax = Math.max(ymax, Number.isFinite(d.hi) ? d.hi : d.y);
    const o = osy(g, w, h, xmin, xmax, 0, (ymax || 1) * 1.1, volby.popisY, volby.popisX);
    if (volby.referencni !== undefined) {
      const Y = Math.round(o.sy(volby.referencni)) + 0.5;
      g.save(); g.strokeStyle = css('--text-muted', '#aaa'); g.setLineDash([5, 4]);
      g.beginPath(); g.moveTo(o.L, Y); g.lineTo(w - o.R, Y); g.stroke(); g.restore();
    }
    const barva = volby.barva || css('--accent', '#6aa6fd');
    for (const d of ok) {
      const x0 = o.sx(d.od) + 1, x1 = o.sx(d.do) - 1, y = o.sy(d.y);
      g.fillStyle = barva; g.globalAlpha = 0.75; g.fillRect(x0, y, Math.max(1, x1 - x0), h - o.B - y); g.globalAlpha = 1;
      if (Number.isFinite(d.lo) && Number.isFinite(d.hi)) {
        const X = (x0 + x1) / 2, Y1 = o.sy(d.lo), Y2 = o.sy(d.hi);
        g.strokeStyle = css('--text', '#ddd'); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(X, Y1); g.lineTo(X, Y2); g.moveTo(X - 3, Y1); g.lineTo(X + 3, Y1); g.moveTo(X - 3, Y2); g.lineTo(X + 3, Y2); g.stroke();
      }
    }
    cv._tip = X => {
      const xv = o.zx(X), d = data.find(q => xv >= q.od && xv < q.do) || (xv >= xmax ? data[data.length - 1] : null);
      if (!d) return null;
      return { x: o.sx((d.od + d.do) / 2), titul: d.titul || '', radky: [{ barva, text: d.popis || cislo(d.y, 2) }] };
    };
    pripojTip(cv);
  }

  window.EvoGrafy = { cary, mapa, sloupce, bodovy, intervaly, css, cislo, priprav, stahniPng, osy };
})();
