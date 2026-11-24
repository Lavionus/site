/* ============================================================
   Pergamen – obrazek.js
   Editor vkládaného obrázku: barva do průhlednosti (kapátko,
   tolerance, měkký okraj), ořez tažením, otočení a zrcadlení,
   jas a kontrast, režim barev (černobílý, sépie, „jako inkoust“)
   a zmenšení rozlišení. Pixely zpracovává PERGAMEN.zpracujPixely.
     PERGAMEN_OBRAZEK.nacti(file)            → Promise<dataURL> (max 3000 px)
     PERGAMEN_OBRAZEK.vyrob(src, nastaveni)  → Promise<{src, w, h}>
     PERGAMEN_OBRAZEK.uprav(src, nastaveni, volby) → Promise<{src, w, h, nastaveni, umisteni} | null>
       volby.umisteni = true → v patičce výběr Volně na list / Do textu (obtékání)
   Ořez: v režimu ✂ se ukazuje celý obrázek s výřezem; po tažení se náhled
   přepne na už oříznutý obrázek a další úpravy (kapátko, barvy…) jdou na něm.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PERGAMEN;
  const MAX_ZDROJ = 3000, MAX_VYSLEDEK = 2400;

  const obrazek = src => new Promise((ok, chyba) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => chyba(new Error('Obrázek nejde načíst.')); i.src = src; });
  const platno = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  async function nacti(file) {
    if (!/^image\//.test(file.type)) throw new Error('Soubor „' + file.name + '“ není obrázek.');
    const url = URL.createObjectURL(file);
    try {
      const img = await obrazek(url);
      const k = Math.min(1, MAX_ZDROJ / Math.max(img.naturalWidth, img.naturalHeight));
      const c = platno(img.naturalWidth * k, img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  }

  /* Otočení (po 90°) a zrcadlení celého zdroje. */
  function otoc(img, n) {
    const r = ((n.rot || 0) % 360 + 360) % 360, bok = r === 90 || r === 270;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = platno(bok ? h : w, bok ? w : h), x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.rotate(r * Math.PI / 180);
    if (n.zrcadlo) x.scale(-1, 1);
    x.drawImage(img, -w / 2, -h / 2);
    return c;
  }
  /* Ořez (podíly 0–1 otočeného obrázku), zmenšení a úprava pixelů. */
  function dokonci(otoceny, n, maxRozmer) {
    const o = n.orez || { x: 0, y: 0, w: 1, h: 1 };
    const sx = o.x * otoceny.width, sy = o.y * otoceny.height, sw = Math.max(1, o.w * otoceny.width), sh = Math.max(1, o.h * otoceny.height);
    const k = Math.min(n.meritko || 1, (maxRozmer || MAX_VYSLEDEK) / Math.max(sw, sh));
    const c = platno(sw * k, sh * k), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(otoceny, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height);
    P.zpracujPixely(d.data, n); x.putImageData(d, 0, 0);
    return c;
  }
  async function vyrob(src, n) {
    const c = dokonci(otoc(await obrazek(src), n), n);
    return { src: c.toDataURL('image/png'), w: c.width, h: c.height };
  }

  /* ---------- dialog ---------- */
  const CSS = `
.po-zavoj{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px}
.po-okno{background:var(--bg-panel);color:var(--text);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);width:min(1020px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden}
.po-hlava{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:600}
.po-telo{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;padding:12px 14px;overflow:auto;min-height:0}
@media (max-width:760px){.po-telo{grid-template-columns:1fr}}
.po-nahled{display:flex;align-items:center;justify-content:center;min-height:240px;border-radius:8px;background-color:#ddd;background-image:linear-gradient(45deg,#bbb 25%,transparent 25%,transparent 75%,#bbb 75%),linear-gradient(45deg,#bbb 25%,transparent 25%,transparent 75%,#bbb 75%);background-size:16px 16px;background-position:0 0,8px 8px}
.po-nahled canvas{max-width:100%;touch-action:none;cursor:crosshair}
.po-nahled canvas.kapatko{cursor:copy}
.po-ovladani label{display:block;font-size:.78rem;color:var(--text-muted);margin:8px 0 3px}
.po-ovladani input[type=range]{width:100%}
.po-ovladani select{width:100%;background:var(--bg-input);border:1px solid var(--border-strong);border-radius:6px;color:var(--text);padding:5px 7px;font:inherit}
.po-ovladani .rad{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.po-ovladani .zaskrt{display:flex;align-items:center;gap:6px;font-size:.86rem;color:var(--text)}
.po-ovladani input[type=color]{width:36px;height:24px;padding:0;border:1px solid var(--border-strong);border-radius:5px;background:none;flex:0 0 auto}
.po-ovladani h4{margin:12px 0 2px;font-size:.84rem}
.po-ovladani h4:first-child{margin-top:0}
.po-info{font-size:.78rem;color:var(--text-faint);margin-top:4px}
.po-pata{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:1px solid var(--border)}
.po-ovladani .tl[aria-pressed="true"]{background:var(--accent-soft);border-color:var(--accent)}
.po-umisteni{display:flex;align-items:center;gap:6px;font-size:.84rem;color:var(--text-muted)}
.po-umisteni select{background:var(--bg-input);border:1px solid var(--border-strong);border-radius:6px;color:var(--text);padding:4px 6px;font:inherit}
.po-nahled canvas.orez{cursor:crosshair}
.po-nahled canvas:not(.orez):not(.kapatko){cursor:default}`;
  let styl = null;

  function uprav(src, nastaveni, volby) {
    const v = volby || {};
    if (!styl) { styl = document.createElement('style'); styl.textContent = CSS; document.head.appendChild(styl); }
    const n = Object.assign(P.VYCHOZI_OBRAZEK(), JSON.parse(JSON.stringify(nastaveni || {})));
    n.pruhledna = Object.assign(P.VYCHOZI_OBRAZEK().pruhledna, n.pruhledna || {});
    return obrazek(src).then(img => new Promise(hotovo => {
      const zavoj = document.createElement('div');
      zavoj.className = 'po-zavoj';
      zavoj.innerHTML = `<div class="po-okno" role="dialog" aria-modal="true" aria-label="Úprava obrázku">
        <div class="po-hlava">🖼️ Úprava obrázku<span style="flex:1"></span><button class="tl" data-a="zrusit" aria-label="Zavřít">✕</button></div>
        <div class="po-telo">
          <div class="po-nahled"><canvas></canvas></div>
          <div class="po-ovladani">
            <h4>Nástroj v náhledu</h4>
            <div class="rad"><button class="tl" data-nastroj="orez" aria-pressed="false" title="Táhněte v náhledu výřez – pak se ukáže oříznutý obrázek">✂ Ořez</button>
              <button class="tl" data-nastroj="kapatko" aria-pressed="false" title="Klikněte na barvu, která má zmizet">💧 Kapátko</button>
              <button class="tl" data-a="bezOrezu" title="Zrušit ořez">⬚ Celý</button></div>
            <div class="po-info" data-stav-orezu></div>
            <div class="rad" style="margin-top:6px"><button class="tl" data-a="otocL" title="Otočit doleva">⟲</button><button class="tl" data-a="otocP" title="Otočit doprava">⟳</button><button class="tl" data-a="zrcadlo" title="Zrcadlit">⇋</button></div>
            <h4>Barva do průhlednosti</h4>
            <label class="zaskrt"><input type="checkbox" data-n="pruhledna.zap"> Odstranit barvu <input type="color" data-n="pruhledna.barva"></label>
            <label>Tolerance <span data-h="pruhledna.tolerance"></span></label><input type="range" min="0" max="60" data-n="pruhledna.tolerance">
            <label>Měkký okraj <span data-h="pruhledna.mekkost"></span></label><input type="range" min="0" max="60" data-n="pruhledna.mekkost">
            <h4>Barvy</h4>
            <select data-n="rezim"><option value="puvodni">Původní barvy</option><option value="cb">Černobílý</option><option value="sepie">Sépie</option><option value="inkoust">Jako inkoust (kresba)</option></select>
            <label class="zaskrt" data-jen="inkoust">Barva inkoustu <input type="color" data-n="inkoust"></label>
            <label>Jas <span data-h="jas"></span></label><input type="range" min="-100" max="100" data-n="jas">
            <label>Kontrast <span data-h="kontrast"></span></label><input type="range" min="-100" max="100" data-n="kontrast">
            <h4>Velikost</h4>
            <label>Rozlišení <span data-h="meritko"></span></label><input type="range" min="5" max="100" data-n="meritko">
            <div class="po-info" data-info></div>
          </div>
        </div>
        <div class="po-pata">${v.umisteni ? `<label class="po-umisteni">Umístění <select data-umisteni><option value="volne">Volně na list (táhnout myší)</option><option value="text-left">Do textu – vlevo, text obtéká</option><option value="text-right">Do textu – vpravo, text obtéká</option><option value="text-center">Do textu – na střed</option></select></label>` : ''}<span style="flex:1"></span><button class="tl" data-a="zrusit">Zrušit</button><button class="tl hlavni-tl" data-a="ok">Použít</button></div>
      </div>`;
      document.body.appendChild(zavoj);
      const q = s => zavoj.querySelector(s), cv = q('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
      let otoceny = null, nahledZdroj = null, pohledRect = null, nastroj = 'zadny', tah = null;
      if (v.umisteni && v.vychoziUmisteni) q('[data-umisteni]').value = v.vychoziUmisteni;
      const cesta = (k, v) => { const c = k.split('.'); let o = n; for (let i = 0; i < c.length - 1; i++) o = o[c[i]]; if (v === undefined) return o[c[c.length - 1]]; o[c[c.length - 1]] = v; };

      function pripravZdroj() { otoceny = otoc(img, n); pripravPohled(); }
      /* Náhled: v ořezu celý obrázek (výřez se kreslí přes), jinak už oříznutý a zvětšený na plochu. */
      function pripravPohled() {
        const o = nastroj !== 'orez' && n.orez ? n.orez : { x: 0, y: 0, w: 1, h: 1 };
        pohledRect = o;
        const sw = o.w * otoceny.width, sh = o.h * otoceny.height;
        const box = q('.po-nahled'), mw = Math.max(200, Math.min(640, box.clientWidth - 16)), mh = Math.min(480, innerHeight * 0.55);
        const k = Math.min(mw / sw, mh / sh, nastroj === 'orez' || !n.orez ? 1 : 4);
        cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
        const t = platno(cv.width, cv.height); t.getContext('2d').drawImage(otoceny, o.x * otoceny.width, o.y * otoceny.height, sw, sh, 0, 0, t.width, t.height);
        nahledZdroj = t.getContext('2d').getImageData(0, 0, t.width, t.height);
        q('[data-stav-orezu]').textContent = n.orez ? (nastroj === 'orez' ? 'Táhněte nový výřez; jiným nástrojem uvidíte oříznutý obrázek.' : '✂ Oříznuto – náhled ukazuje výřez.') : (nastroj === 'orez' ? 'Táhněte v náhledu výřez.' : '');
      }
      function kresli() {
        const d = new ImageData(new Uint8ClampedArray(nahledZdroj.data), nahledZdroj.width, nahledZdroj.height);
        P.zpracujPixely(d.data, n);
        cx.clearRect(0, 0, cv.width, cv.height); cx.putImageData(d, 0, 0);
        const o = nastroj === 'orez' ? n.orez : null;
        if (o) {   // v režimu ořezu ztmavit vše mimo výřez
          const x = o.x * cv.width, y = o.y * cv.height, w = o.w * cv.width, h = o.h * cv.height;
          cx.save(); cx.fillStyle = 'rgba(0,0,0,.5)';
          cx.beginPath(); cx.rect(0, 0, cv.width, cv.height); cx.rect(x, y, w, h); cx.fill('evenodd');
          cx.strokeStyle = '#fff'; cx.setLineDash([5, 4]); cx.lineWidth = 1.5; cx.strokeRect(x + .5, y + .5, w - 1, h - 1); cx.restore();
        }
        const ow = (n.orez ? n.orez.w : 1) * otoceny.width, oh = (n.orez ? n.orez.h : 1) * otoceny.height;
        const k = Math.min(n.meritko, MAX_VYSLEDEK / Math.max(ow, oh));
        q('[data-info]').textContent = `Výsledek ${Math.round(ow * k)} × ${Math.round(oh * k)} px`;
      }
      function nastavPole() {
        zavoj.querySelectorAll('[data-n]').forEach(el => {
          const v = cesta(el.dataset.n);
          if (el.type === 'checkbox') el.checked = !!v;
          else el.value = el.dataset.n === 'meritko' ? Math.round(v * 100) : v;
        });
        zavoj.querySelectorAll('[data-h]').forEach(el => { const v = cesta(el.dataset.h); el.textContent = el.dataset.h === 'meritko' ? Math.round(v * 100) + ' %' : v; });
        q('[data-jen="inkoust"]').hidden = n.rezim !== 'inkoust';
        zavoj.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === nastroj)));
        cv.classList.toggle('kapatko', nastroj === 'kapatko'); cv.classList.toggle('orez', nastroj === 'orez');
      }
      zavoj.addEventListener('input', e => {
        const el = e.target.closest('[data-n]'); if (!el) return;
        const k = el.dataset.n;
        cesta(k, el.type === 'checkbox' ? el.checked : el.type === 'range' ? (k === 'meritko' ? +el.value / 100 : +el.value) : el.value);
        if (k === 'pruhledna.barva') cesta('pruhledna.zap', true);
        nastavPole(); kresli();
      });
      const zavri = v => { zavoj.remove(); removeEventListener('keydown', klavesa, true); hotovo(v); };
      const klavesa = e => { if (e.key === 'Escape') { e.stopPropagation(); zavri(null); } };
      addEventListener('keydown', klavesa, true);
      zavoj.addEventListener('click', async e => {
        const b = e.target.closest('[data-a],[data-nastroj]'); if (!b) return;
        if (b.dataset.nastroj) { nastroj = nastroj === b.dataset.nastroj ? 'zadny' : b.dataset.nastroj; pripravPohled(); nastavPole(); kresli(); return; }
        switch (b.dataset.a) {
          case 'zrusit': return zavri(null);
          case 'bezOrezu': n.orez = null; pripravPohled(); break;
          case 'otocL': n.rot = (n.rot + 270) % 360; n.orez = null; pripravZdroj(); break;
          case 'otocP': n.rot = (n.rot + 90) % 360; n.orez = null; pripravZdroj(); break;
          case 'zrcadlo': n.zrcadlo = !n.zrcadlo; n.orez = null; pripravZdroj(); break;
          case 'ok': {
            b.disabled = true;
            const c = dokonci(otoceny, n);
            return zavri({ src: c.toDataURL('image/png'), w: c.width, h: c.height, nastaveni: n, umisteni: v.umisteni ? q('[data-umisteni]').value : 'volne' });
          }
        }
        kresli();
      });
      // ořez tažením, kapátko klikem
      const bod = e => { const r = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
      cv.addEventListener('pointerdown', e => {
        const b = bod(e);
        if (nastroj === 'kapatko') {
          const x = Math.min(nahledZdroj.width - 1, Math.floor(b.x * nahledZdroj.width)), y = Math.min(nahledZdroj.height - 1, Math.floor(b.y * nahledZdroj.height));
          const i = (y * nahledZdroj.width + x) * 4, d = nahledZdroj.data;
          n.pruhledna.barva = '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
          n.pruhledna.zap = true; nastavPole(); kresli(); return;
        }
        if (nastroj !== 'orez') return;
        tah = b; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* nevadí */ }
      });
      cv.addEventListener('pointermove', e => {
        if (!tah) return;
        const b = bod(e), x = Math.min(tah.x, b.x), y = Math.min(tah.y, b.y), w = Math.abs(b.x - tah.x), h = Math.abs(b.y - tah.y);
        n.orez = w > 0.01 && h > 0.01 ? { x, y, w, h } : null; kresli();
      });
      // po dotažení výřezu ukázat oříznutý obrázek a pokračovat v úpravách (kapátkem)
      const konecOrezu = () => { if (!tah) return; tah = null; if (n.orez) { nastroj = 'kapatko'; pripravPohled(); nastavPole(); kresli(); } };
      cv.addEventListener('pointerup', konecOrezu); cv.addEventListener('pointercancel', konecOrezu);
      requestAnimationFrame(() => { pripravZdroj(); nastavPole(); kresli(); q('[data-a="ok"]').focus(); });
    }));
  }

  window.PERGAMEN_OBRAZEK = { nacti, vyrob, uprav };
})();
