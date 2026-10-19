/* Voynichův rukopis – plocha s obrázkem: přiblížení (kolečko, prsty, dvojklik), posun tažením,
 * otáčení po 90°, filtry obrazu, minimapa. Nejdřív se ukáže náhled, plný snímek se dotáhne. */
(function () {
  'use strict';
  const MIN_Z = 0.03, MAX_Z = 8;

  class Plocha {
    constructor(el, volby) {
      this.el = el;
      this.volby = volby || {};
      this.s = 1; this.x = 0; this.y = 0; this.rot = 0;
      this.w = 1; this.h = 1;
      this.img = document.createElement('img');
      this.img.className = 'obraz';
      this.img.alt = '';
      this.img.draggable = false;
      this.stitek = document.createElement('div'); this.stitek.className = 'stitek';
      this.nacitani = document.createElement('div'); this.nacitani.className = 'nacitani skryto'; this.nacitani.textContent = 'načítám plné rozlišení…';
      this.mini = document.createElement('div'); this.mini.className = 'minimapa skryto';
      this.miniImg = document.createElement('img'); this.miniImg.alt = '';
      this.miniRam = document.createElement('i');
      this.mini.append(this.miniImg, this.miniRam);
      el.append(this.img, this.stitek, this.nacitani, this.mini);
      this.ukazatele = new Map();
      this.prizpusobeno = 'cele';
      this._udalosti();
      if ('ResizeObserver' in window) {
        let posl = null;
        new ResizeObserver(() => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const k = r.width + 'x' + r.height;
          if (k === posl) return;
          const prvni = posl === null;
          posl = k;
          if (prvni || this.prizpusobeno) this.prizpusob(this.prizpusobeno || 'cele');
          else this._kresli();
        }).observe(el);
      }
    }

    get W() { return this.rot % 180 ? this.h : this.w; }
    get H() { return this.rot % 180 ? this.w : this.h; }

    // obr: {url, nahled, w, h, popis}
    nastav(obr, zachovatPohled) {
      this.obr = obr;
      const stejnyRozmer = this.w === obr.w && this.h === obr.h;
      this.w = obr.w; this.h = obr.h;
      this.img.style.width = obr.w + 'px';
      this.img.style.height = obr.h + 'px';
      this.stitek.textContent = obr.popis || '';
      this.stitek.classList.toggle('skryto', !obr.popis);
      this.miniImg.src = obr.nahled;
      const token = this._token = {};
      this.img.src = obr.nahled;
      this.nacitani.classList.remove('skryto');
      const plne = new Image();
      plne.decoding = 'async';
      plne.onload = () => {
        if (this._token !== token) return;
        this.img.src = obr.url;
        this.nacitani.classList.add('skryto');
        if (this.volby.naNacteni) this.volby.naNacteni(this);
      };
      plne.onerror = () => { if (this._token === token) this.nacitani.textContent = 'plný snímek se nepodařilo načíst'; };
      plne.src = obr.url;
      if (!(zachovatPohled && stejnyRozmer)) { this.rot = 0; this.prizpusob('cele'); }
      else this._kresli();
    }

    rozmerPlochy() { const r = this.el.getBoundingClientRect(); return { w: r.width || 1, h: r.height || 1 }; }

    prizpusob(jak) {
      const p = this.rozmerPlochy();
      const okraj = 8;
      const sw = (p.w - 2 * okraj) / this.W, sh = (p.h - 2 * okraj) / this.H;
      this.s = jak === 'sirka' ? sw : jak === '1:1' ? 1 : Math.min(sw, sh);
      this.s = Math.max(MIN_Z, Math.min(MAX_Z, this.s));
      this.x = (p.w - this.W * this.s) / 2;
      this.y = jak === 'sirka' ? okraj : (p.h - this.H * this.s) / 2;
      if (jak === '1:1') { this.y = Math.max(okraj, this.y); }
      this.prizpusobeno = jak === '1:1' ? null : jak;
      this._kresli();
    }

    meritkoCelku() {
      const p = this.rozmerPlochy();
      return Math.min((p.w - 16) / this.W, (p.h - 16) / this.H);
    }

    zoomKolem(faktor, cx, cy) {
      const p = this.rozmerPlochy();
      if (cx == null) { cx = p.w / 2; cy = p.h / 2; }
      const ns = Math.max(MIN_Z, Math.min(MAX_Z, this.s * faktor));
      const k = ns / this.s;
      this.x = cx - (cx - this.x) * k;
      this.y = cy - (cy - this.y) * k;
      this.s = ns;
      this.prizpusobeno = null;
      this._kresli();
    }

    otoc(o) {
      const p = this.rozmerPlochy();
      const r = this.relativni();
      this.rot = ((this.rot + (o || 90)) % 360 + 360) % 360;
      if (this.prizpusobeno) this.prizpusob(this.prizpusobeno);
      else { this.nastavRelativni(r); }
      void p;
    }

    posun(dx, dy) { this.x += dx; this.y += dy; this.prizpusobeno = null; this._kresli(); }

    filtr(css) { this.img.style.filter = css || ''; }

    // pohled nezávislý na velikosti snímku – pro synchronizaci dvou ploch
    relativni() {
      const p = this.rozmerPlochy();
      return { z: this.s / this.meritkoCelku(), cx: (p.w / 2 - this.x) / (this.W * this.s), cy: (p.h / 2 - this.y) / (this.H * this.s) };
    }
    nastavRelativni(r) {
      const p = this.rozmerPlochy();
      this.s = Math.max(MIN_Z, Math.min(MAX_Z, r.z * this.meritkoCelku()));
      this.x = p.w / 2 - r.cx * this.W * this.s;
      this.y = p.h / 2 - r.cy * this.H * this.s;
      this.prizpusobeno = null;
      this._kresli(true);
    }

    _kresli(bezOznameni) {
      // nepustit snímek úplně mimo plochu
      const p = this.rozmerPlochy();
      const sw = this.W * this.s, sh = this.H * this.s, m = 60;
      this.x = Math.min(p.w - m, Math.max(m - sw, this.x));
      this.y = Math.min(p.h - m, Math.max(m - sh, this.y));
      let ox = 0, oy = 0;
      if (this.rot === 90) ox = this.h;
      else if (this.rot === 180) { ox = this.w; oy = this.h; }
      else if (this.rot === 270) oy = this.w;
      this.img.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.s}) translate(${ox}px, ${oy}px) rotate(${this.rot}deg)`;
      this._minimapa(p);
      if (!bezOznameni && this.volby.naZmenu) this.volby.naZmenu(this);
    }

    _minimapa(p) {
      const celek = this.meritkoCelku();
      const ukaz = this.s > celek * 1.35 && p.w > 320;
      this.mini.classList.toggle('skryto', !ukaz);
      if (!ukaz) return;
      const mw = 110, k = mw / this.W, mh = this.H * k;
      this.mini.style.width = mw + 'px'; this.mini.style.height = mh + 'px';
      const rot = this.rot;
      this.miniImg.style.width = (rot % 180 ? mh : mw) + 'px';
      this.miniImg.style.height = (rot % 180 ? mw : mh) + 'px';
      this.miniImg.style.transformOrigin = '0 0';
      let ox = 0, oy = 0;
      if (rot === 90) ox = mw; else if (rot === 180) { ox = mw; oy = mh; } else if (rot === 270) oy = mh;
      this.miniImg.style.transform = `translate(${ox}px, ${oy}px) rotate(${rot}deg)`;
      const x0 = Math.max(0, -this.x / this.s * k), y0 = Math.max(0, -this.y / this.s * k);
      const x1 = Math.min(mw, (p.w - this.x) / this.s * k), y1 = Math.min(mh, (p.h - this.y) / this.s * k);
      Object.assign(this.miniRam.style, { left: x0 + 'px', top: y0 + 'px', width: Math.max(2, x1 - x0) + 'px', height: Math.max(2, y1 - y0) + 'px' });
    }

    _udalosti() {
      const el = this.el;
      el.addEventListener('wheel', e => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        if (e.shiftKey && !e.ctrlKey) { this.posun(-e.deltaY, 0); return; }
        const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        this.zoomKolem(Math.exp(-d * 0.0018), e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* syntetické události */ }
        this.ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
        el.classList.add('tahne');
        if (this.volby.naAktivaci) this.volby.naAktivaci(this);
        this._pinch = null;
      });
      el.addEventListener('pointermove', e => {
        const u = this.ukazatele.get(e.pointerId);
        if (!u) return;
        const r = el.getBoundingClientRect();
        if (this.ukazatele.size === 2) {
          const [a, b] = Array.from(this.ukazatele.entries());
          const pa = a[0] === e.pointerId ? { x: e.clientX, y: e.clientY } : a[1];
          const pb = b[0] === e.pointerId ? { x: e.clientX, y: e.clientY } : b[1];
          const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
          const cx = (pa.x + pb.x) / 2 - r.left, cy = (pa.y + pb.y) / 2 - r.top;
          if (this._pinch) {
            this.posun(cx - this._pinch.cx, cy - this._pinch.cy);
            this.zoomKolem(d / this._pinch.d, cx, cy);
          }
          this._pinch = { d, cx, cy };
        } else {
          this.posun(e.clientX - u.x, e.clientY - u.y);
        }
        u.x = e.clientX; u.y = e.clientY;
      });
      const konec = e => {
        this.ukazatele.delete(e.pointerId);
        if (!this.ukazatele.size) el.classList.remove('tahne');
        this._pinch = null;
      };
      el.addEventListener('pointerup', konec);
      el.addEventListener('pointercancel', konec);
      el.addEventListener('dblclick', e => {
        const r = el.getBoundingClientRect();
        this.zoomKolem(e.shiftKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top);
      });
    }
  }

  window.VoynichPlocha = Plocha;
})();
