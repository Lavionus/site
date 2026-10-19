/* ============================================================
   epidemie/graf.js – čárové grafy na canvasu (bez knihoven).
   - respektuje devicePixelRatio, překreslí se při změně velikosti i tématu
   - barvy z CSS proměnných (řada má jméno proměnné, např. '--c-i')
   - nitkový kříž + bublina (myš, dotyk, šipky na zaměřeném grafu)
   - legenda v HTML (klik skryje/ukáže řadu), popisky na koncích čar
   - pásy (kvantilové intervaly), svislé a vodorovné referenční čáry, logaritmická osa Y
   - export do PNG
   ============================================================ */
(function () {
  'use strict';

  const fmtCislo = (x, des) => {
    if (!Number.isFinite(x)) return '–';
    if (x === 0) x = 0; // −0 → 0
    const a = Math.abs(x);
    let d = des;
    if (d == null) d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
    return x.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: d });
  };
  function hezkyKrok(rozsah, cil) {
    const hruby = rozsah / Math.max(1, cil);
    const mag = Math.pow(10, Math.floor(Math.log10(hruby)));
    const n = hruby / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function zkratka(x) {
    const a = Math.abs(x);
    if (a >= 1e9) return fmtCislo(x / 1e9, 1) + ' mld.';
    if (a >= 1e6) return fmtCislo(x / 1e6, a >= 1e7 ? 0 : 1) + ' mil.';
    if (a >= 1e4) return fmtCislo(x / 1e3, 0) + ' tis.';
    return fmtCislo(x);
  }

  class Graf {
    /**
     * @param {HTMLCanvasElement} platno
     * @param {object} volby { vyska, popisX, legenda, formatY, desY, titulek, logY, popisKurzor }
     */
    constructor(platno, volby = {}) {
      this.platno = platno;
      this.ctx = platno.getContext('2d');
      this.v = Object.assign({ vyska: 260, popisX: 'den', formatY: zkratka, desY: null, logY: false }, volby);
      this.rady = []; this.pasma = []; this.hLinie = []; this.vLinie = [];
      this.kurzor = null;
      this.skryte = new Set();
      platno.style.height = this.v.vyska + 'px';
      platno.tabIndex = 0;
      platno.setAttribute('role', 'img');
      new ResizeObserver(() => this.kresli()).observe(platno);
      const pohyb = (e) => { const r = platno.getBoundingClientRect(); this._najedi(e.clientX - r.left); };
      platno.addEventListener('pointermove', pohyb);
      platno.addEventListener('pointerdown', pohyb);
      platno.addEventListener('pointerleave', () => { this.kurzor = null; this.kresli(); });
      platno.addEventListener('keydown', (e) => {
        const n = this._delka();
        if (!n) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const k = this.kurzor == null ? 0 : this.kurzor + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1);
          this.kurzor = Math.max(0, Math.min(n - 1, k));
          this.kresli();
        } else if (e.key === 'Escape') { this.kurzor = null; this.kresli(); }
      });
      platno.addEventListener('blur', () => { this.kurzor = null; this.kresli(); });
      Graf.vsechny.push(this);
    }

    _osaX() { return (this.rady.find(r => r.x && r.x.length && !r.pas) || this.rady.find(r => r.x && r.x.length) || {}).x || []; }
    _delka() { return this._osaX().length; }

    /** data: { rady:[{ id, nazev, kratce, barva, x, y, y2 (pás), pas, carky, sirka, popisKonec, pruhlednost, body, jenBody, bezLegendy, bezBubliny }], pasma, hLinie, vLinie, maxX, minX, maxY, minY } */
    nastav(data) {
      this.rady = data.rady || [];
      this.pasma = data.pasma || [];
      this.hLinie = data.hLinie || [];
      this.vLinie = data.vLinie || [];
      this.maxX = data.maxX; this.minX = data.minX || 0;
      this.maxY = data.maxY; this.minY = data.minY;
      if (this.kurzor != null && this.kurzor >= this._delka()) this.kurzor = null;
      this._legenda();
      this.kresli();
      const pop = this.rady.filter(r => !this.skryte.has(r.id) && !r.bezLegendy).map(r => r.nazev).join(', ');
      this.platno.setAttribute('aria-label', (this.v.titulek || 'Graf') + ': ' + pop + '. Šipkami vlevo a vpravo lze procházet hodnoty.');
    }

    _legenda() {
      const el = this.v.legenda;
      if (!el) return;
      el.innerHTML = '';
      const videne = new Set();
      for (const r of this.rady) {
        if (r.bezLegendy || videne.has(r.id)) continue;
        videne.add(r.id);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'leg-polozka';
        b.setAttribute('aria-pressed', String(!this.skryte.has(r.id)));
        const vz = document.createElement('i');
        vz.style.background = `var(${r.barva})`;
        if (r.carky) vz.className = 'carkovana';
        if (r.pas) vz.className = 'pas';
        b.appendChild(vz);
        b.appendChild(document.createTextNode(r.nazev));
        b.title = 'Skrýt / zobrazit řadu';
        b.addEventListener('click', () => {
          if (this.skryte.has(r.id)) this.skryte.delete(r.id); else this.skryte.add(r.id);
          b.setAttribute('aria-pressed', String(!this.skryte.has(r.id)));
          this.kresli();
        });
        el.appendChild(b);
      }
    }

    _najedi(px) {
      const xs = this._osaX();
      if (!xs.length || !this._mer) return;
      const { x0, sir, maxX, minX } = this._mer;
      const tx = minX + (px - x0) / sir * (maxX - minX);
      let nej = 0, d = Infinity;
      for (let i = 0; i < xs.length; i++) { const dd = Math.abs(xs[i] - tx); if (dd < d) { d = dd; nej = i; } }
      this.kurzor = nej;
      this.kresli();
    }

    /** Uloží graf jako PNG (s pozadím panelu, aby byl čitelný i mimo stránku). */
    png(nazev) {
      const pl = this.platno;
      const c = document.createElement('canvas');
      c.width = pl.width; c.height = pl.height;
      const x = c.getContext('2d');
      x.fillStyle = getComputedStyle(pl).getPropertyValue('--bg-panel').trim() || '#fff';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(pl, 0, 0);
      c.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (nazev || this.v.titulek || 'graf').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, 'image/png');
    }

    kresli() {
      const pl = this.platno, ctx = this.ctx;
      const css = getComputedStyle(pl);
      const w = pl.clientWidth, h = pl.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      if (pl.width !== Math.round(w * dpr) || pl.height !== Math.round(h * dpr)) { pl.width = Math.round(w * dpr); pl.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const barva = (v) => css.getPropertyValue(v).trim() || '#888';
      const cText = barva('--text'), cMuted = barva('--text-muted'), cGrid = barva('--border'), cPanel = barva('--bg-elevated');
      const pismo = '12px ' + (css.getPropertyValue('--font').trim() || 'sans-serif');
      ctx.font = pismo;
      const logY = !!this.v.logY;

      const viditelne = this.rady.filter(r => !this.skryte.has(r.id) && r.x && r.x.length);
      let minX = this.minX || 0, maxX = this.maxX || 1;
      if (!this.maxX) for (const r of this.rady) if (r.x && r.x.length) maxX = Math.max(maxX, r.x[r.x.length - 1]);
      if (maxX <= minX) maxX = minX + 1;
      let maxY = this.maxY != null ? this.maxY : 0, minY = this.minY != null ? this.minY : 0;
      if (this.maxY == null) {
        for (const r of viditelne) { for (const y of r.y) if (Number.isFinite(y) && y > maxY) maxY = y; if (r.y2) for (const y of r.y2) if (Number.isFinite(y) && y > maxY) maxY = y; }
        for (const l of this.hLinie) if (!l.mimoMeritko) maxY = Math.max(maxY, l.y);
        if (maxY <= minY) maxY = minY + 1;
        if (!logY) maxY *= 1.05;
      }
      let Ymap, ticks = [];
      if (logY) {
        let minPos = Infinity;
        for (const r of viditelne) for (const y of r.y) if (y > 0 && y < minPos) minPos = y;
        const lo = Math.floor(Math.log10(Math.max(minPos === Infinity ? 1 : minPos, maxY * 1e-7, 1e-3)));
        const hi = Math.ceil(Math.log10(Math.max(maxY, 10 ** (lo + 1))));
        minY = 10 ** lo; maxY = 10 ** hi;
        const krok = Math.max(1, Math.ceil((hi - lo) / 6));
        for (let e = lo; e <= hi; e += krok) ticks.push(10 ** e);
        Ymap = (y) => (Math.log10(Math.max(y, minY)) - lo) / (hi - lo);
      } else {
        const krokY = hezkyKrok(maxY - minY, h < 200 ? 3 : 5);
        if (this.maxY == null) maxY = Math.ceil(maxY / krokY - 1e-9) * krokY;
        for (let y = minY; y <= maxY + 1e-9 * Math.abs(maxY); y += krokY) ticks.push(y);
        Ymap = (y) => (y - minY) / (maxY - minY);
      }
      let sirkaPopisu = 0;
      for (const y of ticks) sirkaPopisu = Math.max(sirkaPopisu, ctx.measureText(this.v.formatY(y)).width);
      const malyGraf = w < 420;
      const maPopisKonec = viditelne.some(r => r.popisKonec) && !malyGraf;
      const x0 = Math.ceil(sirkaPopisu) + 12, y0 = 10;
      const pravy = maPopisKonec ? 46 : 12;
      const sir = Math.max(10, w - x0 - pravy), vys = Math.max(10, h - y0 - 34);
      const X = x => x0 + (x - minX) / (maxX - minX) * sir;
      const Y = y => y0 + vys - Ymap(y) * vys;
      this._mer = { x0, sir, maxX, minX };

      for (const p of this.pasma) {
        const a = X(Math.max(minX, p.x0)), b = X(Math.min(maxX, p.x1));
        if (b <= a) continue;
        ctx.fillStyle = barva(p.barva || '--accent-soft');
        ctx.globalAlpha = p.barva ? 0.14 : 1;
        ctx.fillRect(a, y0, b - a, vys);
        ctx.globalAlpha = 1;
        if (p.popis && b - a > 50) { ctx.fillStyle = cMuted; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(p.popis, a + 4, y0 + 2 + (p.radek || 0) * 14); }
      }
      ctx.strokeStyle = cGrid; ctx.lineWidth = 1; ctx.fillStyle = cMuted;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const y of ticks) {
        const py = Math.round(Y(y)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x0 + sir, py); ctx.stroke();
        ctx.fillText(this.v.formatY(y), x0 - 6, py);
      }
      const krokX = hezkyKrok(maxX - minX, Math.max(2, Math.floor(sir / 70)));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = Math.ceil(minX / krokX) * krokX; x <= maxX + 1e-9; x += krokX) {
        const px = Math.round(X(x)) + 0.5;
        ctx.beginPath(); ctx.moveTo(px, y0 + vys); ctx.lineTo(px, y0 + vys + 4); ctx.stroke();
        ctx.fillText((this.v.formatX || (v => fmtCislo(v, 0)))(x), px, y0 + vys + 6);
      }
      ctx.textAlign = 'right';
      ctx.fillText(this.v.popisX, x0 + sir, y0 + vys + 20);
      // pásy (pod čarami)
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0 - 2, sir, vys + 4); ctx.clip();
      for (const r of viditelne) {
        if (!r.pas) continue;
        ctx.fillStyle = barva(r.barva); ctx.globalAlpha = r.pruhlednost || 0.2;
        ctx.beginPath();
        for (let i = 0; i < r.x.length; i++) { const px = X(r.x[i]), py = Y(r.y[i]); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        for (let i = r.x.length - 1; i >= 0; i--) ctx.lineTo(X(r.x[i]), Y(r.y2[i]));
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      }
      // referenční čáry
      const kresliH = (l) => {
        if (l.y < minY || l.y > maxY) return;
        ctx.save(); ctx.setLineDash(l.carky || [5, 4]); ctx.strokeStyle = barva(l.barva || '--text-muted'); ctx.lineWidth = l.sirka || 1.2;
        const py = Math.round(Y(l.y)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x0 + sir, py); ctx.stroke(); ctx.restore();
        if (l.popis) { ctx.fillStyle = cMuted; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(l.popis, x0 + 4, py - 2); }
      };
      this.hLinie.forEach(kresliH);
      for (const l of this.vLinie) {
        if (l.x < minX || l.x > maxX) continue;
        const px = Math.round(X(l.x)) + 0.5;
        ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = barva(l.barva || '--text-muted');
        ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + vys); ctx.stroke(); ctx.restore();
        if (l.popis) { ctx.fillStyle = cMuted; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(l.popis, px + 3, y0 + 2); }
      }
      // čáry
      for (const r of viditelne) {
        if (r.pas) continue;
        ctx.strokeStyle = barva(r.barva); ctx.lineWidth = r.sirka || 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.setLineDash(r.carky || []);
        ctx.globalAlpha = r.pruhlednost || 1;
        if (!r.jenBody) {
          ctx.beginPath();
          let zac = false;
          for (let i = 0; i < r.x.length; i++) {
            const y = r.y[i];
            if (!Number.isFinite(y) || (logY && y <= 0)) { zac = false; continue; }
            const px = X(r.x[i]), py = Y(y);
            if (!zac) { ctx.moveTo(px, py); zac = true; } else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        if (r.body || r.jenBody) {
          ctx.fillStyle = barva(r.barva);
          for (let i = 0; i < r.x.length; i++) if (Number.isFinite(r.y[i])) { ctx.beginPath(); ctx.arc(X(r.x[i]), Y(r.y[i]), r.jenBody ? 2.8 : 2.2, 0, 7); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.setLineDash([]);
      if (maPopisKonec) {
        const popisy = [];
        for (const r of viditelne) {
          if (!r.popisKonec || r.pas) continue;
          let i = r.y.length - 1; while (i > 0 && !Number.isFinite(r.y[i])) i--;
          popisy.push({ y: Math.min(y0 + vys, Math.max(y0, Y(r.y[i]))), text: r.kratce || r.nazev, barva: barva(r.barva) });
        }
        popisy.sort((a, b) => a.y - b.y);
        const dno = y0 + vys - 8;
        for (let i = popisy.length - 1; i >= 0; i--) { const mez = i === popisy.length - 1 ? dno : popisy[i + 1].y - 13; if (popisy[i].y > mez) popisy[i].y = mez; }
        for (let i = 1; i < popisy.length; i++) if (popisy[i].y - popisy[i - 1].y < 13) popisy[i].y = popisy[i - 1].y + 13;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '600 ' + pismo;
        for (const p of popisy) {
          ctx.fillStyle = p.barva; ctx.fillRect(x0 + sir + 4, p.y - 1, 5, 2);
          ctx.fillStyle = cText; ctx.fillText(p.text, x0 + sir + 11, p.y);
        }
        ctx.font = pismo;
      }
      if (this.kurzor != null) {
        const xs = this._osaX();
        const i = Math.min(this.kurzor, xs.length - 1);
        const tx = xs[i];
        const px = Math.round(X(tx)) + 0.5;
        ctx.strokeStyle = cMuted; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + vys); ctx.stroke();
        const radky = [{ text: (this.v.popisKurzor || 'den') + ' ' + (this.v.formatX ? this.v.formatX(tx) : fmtCislo(tx, 1)), barva: null }];
        const fy = this.v.formatBublina || ((y) => fmtCislo(y, this.v.desY));
        for (const r of viditelne) {
          if (r.bezBubliny) continue;
          // index podle x (řady mohou mít různé osy x)
          let k = i;
          if (r.x !== xs) { k = -1; let d = Infinity; for (let q = 0; q < r.x.length; q++) { const dd = Math.abs(r.x[q] - tx); if (dd < d) { d = dd; k = q; } } if (d > 0.51) continue; }
          const y = r.y[k];
          if (!Number.isFinite(y)) continue;
          if (r.pas) { radky.push({ text: (r.kratce || r.nazev) + ': ' + fy(r.y2[k]) + ' – ' + fy(y), barva: barva(r.barva) }); continue; }
          ctx.fillStyle = barva(r.barva); ctx.strokeStyle = cPanel; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, Y(y), 4, 0, 7); ctx.fill(); ctx.stroke();
          radky.push({ text: (r.kratce || r.nazev) + ': ' + fy(y), barva: barva(r.barva) });
        }
        if (radky.length > 14) radky.splice(14, radky.length - 14, { text: '…', barva: null });
        const sirB = Math.max(...radky.map(r => ctx.measureText(r.text).width)) + 26;
        const vysB = radky.length * 16 + 8;
        let bx = px + 10; if (bx + sirB > w - 2) bx = px - 10 - sirB;
        bx = Math.max(2, bx);
        const by = y0 + 4;
        ctx.fillStyle = cPanel; ctx.strokeStyle = cGrid; ctx.lineWidth = 1;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, sirB, vysB, 6); else ctx.rect(bx, by, sirB, vysB); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        radky.forEach((r, k) => {
          const ty = by + 12 + k * 16;
          if (r.barva) { ctx.fillStyle = r.barva; ctx.fillRect(bx + 8, ty - 4, 10, 8); }
          ctx.fillStyle = cText; ctx.fillText(r.text, bx + (r.barva ? 22 : 8), ty);
        });
      }
    }
  }
  Graf.vsechny = [];
  Graf.fmtCislo = fmtCislo;
  Graf.zkratka = zkratka;
  Graf.uklid = () => { Graf.vsechny = Graf.vsechny.filter(g => g.platno.isConnected); };
  new MutationObserver(() => Graf.vsechny.forEach(g => g.kresli()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.EpiGraf = Graf;
})();
