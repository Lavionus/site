/* Kolíčky na prádlo – skicář: 2D editor bočního obrysu ramen v milimetrech.
   Body obrysu (táhnout, dvojklik na bod = ostrý / hladký roh, dvojklik na hranu nebo nástroj ➕ = nový bod,
   Delete / pravé tlačítko = smazat), podklad z fotky (posun, otočení, průhlednost, kalibrace dvěma body),
   měření vzdálenosti a úhlu, mřížka 1 / 10 mm, přichycení. Zobrazuje výsledný profil z geometrie
   (zářezy, kloub, drážky) a dráty pružiny. Podklad se ukládá do IndexedDB (webapp_kolicky). */
/* global KOLICKY, Dialog */
(function () {
  'use strict';
  const K = window.KOLICKY;
  const DB = 'webapp_kolicky', STORE = 'podklad';
  let dbP = null;                                         // jedno sdílené spojení
  function db() {
    if (!dbP) dbP = new Promise((ok, ko) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbP = null; }; ok(d); };
      r.onerror = () => { dbP = null; ko(r.error); };
      r.onblocked = () => { dbP = null; ko(new Error('IndexedDB je blokovaná')); };
    });
    return dbP;
  }
  async function dbCti(klic) {
    try { const d = await db(); return await new Promise(ok => { const r = d.transaction(STORE).objectStore(STORE).get(klic); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); }
    catch (e) { return null; }
  }
  async function dbPis(klic, h) {
    try { const d = await db(); await new Promise(ok => { const t = d.transaction(STORE, 'readwrite'); if (h == null) t.objectStore(STORE).delete(klic); else t.objectStore(STORE).put(h, klic); t.oncomplete = ok; t.onerror = ok; }); }
    catch (e) { /* bez IndexedDB se podklad jen neuloží */ }
  }

  /** cfg: {platno, info, naZmenu(skica, slouceni), stav: () => ({p, o, rezy, duchove})} */
  function vytvor(cfg) {
    const cv = cfg.platno, ctx = cv.getContext('2d');
    const pohled = { s: 6, x0: -6, y0: 22 };             // px na mm, levý horní roh v mm
    let nastroj = 'body', vybrany = null, tah = null, mereni = null, kalib = null, hover = null;
    let podklad = null;                                    // {img, data, x, y, mmNaPx, uhel, pruhlednost}
    let prichytit = true, upravuji = 'horni', aktivni = false;
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const dpr = () => Math.min(window.devicePixelRatio || 1, 3);
    const naPx = (x, y) => [(x - pohled.x0) * pohled.s, (pohled.y0 - y) * pohled.s];
    const naMm = (px, py) => [px / pohled.s + pohled.x0, pohled.y0 - py / pohled.s];
    const naPodklad = () => { if (cfg.naPodklad) cfg.naPodklad(); };

    /* ---------- data ---------- */
    const st = () => cfg.stav();
    const skica = () => st().p.skica;
    const posun = () => (st().o ? st().o.posun : 0);
    function body() {
      const sk = skica();
      return upravuji === 'dolni' && !sk.soumerna ? sk.dolni : sk.horni;
    }
    function zmen(fn, slouceni) {
      const sk = JSON.parse(JSON.stringify(skica()));
      fn(sk);
      cfg.naZmenu(sk, slouceni);
    }
    function prevezmi() {
      const o = st().o;
      zmen(sk => {
        sk.horni = K.obrysNaSkicu(o.parametricky);
        sk.dolni = K.obrysNaSkicu(K.zrcadliY(o.parametricky));
        sk.zapnuta = true;
      });
      vybrany = null;
    }

    /* ---------- kreslení ---------- */
    function velikost() {
      const w = cv.clientWidth || 300, h = cv.clientHeight || 200, r = dpr();
      if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
      return [w, h];
    }
    function prizpusob() {
      const o = st().o; if (!o) return;
      const [w, h] = velikost();
      const b = [Math.min(o.mez.horni[0], o.mez.dolni[0]) - 4, Math.max(o.mez.horni[1], o.mez.dolni[1]) + 4, Math.min(o.mez.dolni[2], o.mez.horni[2]) - 4, Math.max(o.mez.horni[3], o.mez.dolni[3]) + 4];
      pohled.s = Math.max(0.5, Math.min(w / (b[1] - b[0]), h / (b[3] - b[2])));
      pohled.x0 = (b[0] + b[1]) / 2 - w / 2 / pohled.s; pohled.y0 = (b[2] + b[3]) / 2 + h / 2 / pohled.s;
      kresli();
    }
    function cesta(P, zavrena = true) {
      ctx.beginPath();
      P.forEach((b, i) => { const [x, y] = naPx(b[0], b[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      if (zavrena) ctx.closePath();
    }
    /** Vybraný bod mohl po zpět/znovu, předvolbě nebo načtení zmizet. */
    function platnyVyber() {
      const n = body().length;
      if (vybrany != null && vybrany >= n) vybrany = null;
      if (hover != null && hover >= n) hover = null;
      if (tah && tah.druh === 'bod' && tah.i >= n) tah = null;
    }
    function kresli() {
      if (!aktivni) return;
      platnyVyber();
      const [w, h] = velikost(), r = dpr();
      ctx.setTransform(r, 0, 0, r, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const { p, o, rezy, duchove } = st();
      const cText = css('--text') || '#ddd', cPanel = css('--bg-panel') || '#222', cMuted = css('--text-muted') || '#999', cFaint = css('--border') || '#555', cAcc = css('--accent') || '#4a8';
      // podklad
      if (podklad && podklad.img) {
        ctx.save();
        ctx.globalAlpha = podklad.pruhlednost;
        const [px, py] = naPx(podklad.x, podklad.y);
        ctx.translate(px, py); ctx.rotate(-podklad.uhel * Math.PI / 180);
        const k = podklad.mmNaPx * pohled.s;
        ctx.drawImage(podklad.img, 0, 0, podklad.img.width * k, podklad.img.height * k);
        ctx.restore();
      }
      // mřížka
      const [mx0, my1] = naMm(0, 0), [mx1, my0] = naMm(w, h);
      const krok = pohled.s >= 4 ? 1 : pohled.s >= 1.5 ? 5 : 10;
      ctx.lineWidth = 1;
      for (let x = Math.ceil(mx0 / krok) * krok; x <= mx1; x += krok) {
        const [px] = naPx(x, 0); ctx.strokeStyle = cFaint; ctx.globalAlpha = x % 10 === 0 ? 0.55 : 0.22;
        ctx.beginPath(); ctx.moveTo(Math.round(px) + 0.5, 0); ctx.lineTo(Math.round(px) + 0.5, h); ctx.stroke();
      }
      for (let y = Math.ceil(my0 / krok) * krok; y <= my1; y += krok) {
        const [, py] = naPx(0, y); ctx.strokeStyle = cFaint; ctx.globalAlpha = y % 10 === 0 ? 0.55 : 0.22;
        ctx.beginPath(); ctx.moveTo(0, Math.round(py) + 0.5); ctx.lineTo(w, Math.round(py) + 0.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = cMuted; ctx.font = '11px system-ui, sans-serif';
      for (let x = Math.ceil(mx0 / 10) * 10; x <= mx1; x += 10) { const [px] = naPx(x, 0); ctx.fillText(String(x), px + 2, h - 4); }
      for (let y = Math.ceil(my0 / 10) * 10; y <= my1; y += 10) { const [, py] = naPx(0, y); ctx.fillText(String(y), 3, py - 2); }
      if (!o) return;
      // osy: dosednutí čelistí, čep, konec čelisti
      ctx.setLineDash([6, 4]); ctx.strokeStyle = cMuted; ctx.lineWidth = 1;
      const [, y0] = naPx(0, 0); ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
      const [xc] = naPx(o.Lc, 0); ctx.beginPath(); ctx.moveTo(xc, y0 - 40); ctx.lineTo(xc, y0 + 40); ctx.stroke();
      ctx.setLineDash([]);
      const [cx, cy] = naPx(o.xp, 0);
      ctx.strokeStyle = cText; ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
      ctx.fillStyle = cMuted; ctx.fillText('čep', cx + 5, cy - 5); ctx.fillText('konec čelisti', xc + 3, y0 + 38);
      // výsledný profil
      const vypln = (polys, barva, alfa) => {
        if (!polys) return;
        ctx.beginPath();
        for (const P of polys) P.forEach((b, i) => { const [x, y] = naPx(b[0], b[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }), ctx.closePath();
        ctx.globalAlpha = alfa; ctx.fillStyle = barva; ctx.fill('evenodd'); ctx.globalAlpha = 1;
        ctx.strokeStyle = barva; ctx.lineWidth = 1; ctx.stroke();
      };
      if (rezy) {
        vypln(rezy.horni, cAcc, 0.28); vypln(rezy.dolni, cAcc, 0.18);
        for (const d of rezy.dalsi) vypln(d.polygony, css('--ok') || '#3a3', 0.35);
      } else { vypln([o.obrys.horni], cAcc, 0.2); vypln([o.obrys.dolni], cAcc, 0.12); }
      if (duchove) for (const d of duchove) {
        if (d.druh === 'snura' || d.druh === 'tyc') {
          const [x, y] = naPx(d.body[0][0], d.body[0][1]);
          ctx.beginPath(); ctx.arc(x, y, d.r * pohled.s, 0, 2 * Math.PI); ctx.strokeStyle = cMuted; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
          continue;
        }
        cesta(d.body, !!d.uzavrena); ctx.strokeStyle = d.druh === 'guma' ? cText : '#b9c0c7'; ctx.lineWidth = Math.max(1.5, 2 * d.r * pohled.s); ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1;
      }
      // upravovaný obrys
      const sk = p.skica;
      if (sk.zapnuta) {
        const editace = [['horni', sk.horni, posun()]];
        if (!sk.soumerna) editace.push(['dolni', sk.dolni, -posun()]);
        for (const [jm, B, dy] of editace) {
          if (B.length < 2) continue;
          const akt = jm === upravuji || sk.soumerna;
          const kr = K.hladkyObrys(B, sk.hladka).map(b => [b[0], b[1] + dy]);
          cesta(kr); ctx.strokeStyle = akt ? cText : cMuted; ctx.lineWidth = akt ? 2 : 1; ctx.stroke();
          if (!akt) continue;
          cesta(B.map(b => [b[0], b[1] + dy])); ctx.setLineDash([2, 3]); ctx.strokeStyle = cMuted; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
          B.forEach((b, i) => {
            const [x, y] = naPx(b[0], b[1] + dy), vyb = i === vybrany, hov = i === hover;
            ctx.beginPath();
            if (b[2]) ctx.rect(x - 4.5, y - 4.5, 9, 9); else ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = vyb ? cAcc : cPanel; ctx.fill();
            ctx.strokeStyle = vyb || hov ? cAcc : cText; ctx.lineWidth = hov ? 2.5 : 1.5; ctx.stroke();
          });
        }
      }
      // měření a kalibrace
      const usecka = (a, b, text) => {
        const [x1, y1] = naPx(a[0], a[1]), [x2, y2] = naPx(b[0], b[1]);
        ctx.strokeStyle = css('--warn') || '#e90'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fillStyle = css('--warn') || '#e90'; ctx.fill(); }
        ctx.font = '600 12px system-ui, sans-serif'; ctx.fillStyle = cText; ctx.fillText(text, (x1 + x2) / 2 + 6, (y1 + y2) / 2 - 6);
      };
      if (mereni && mereni.b) {
        const d = Math.hypot(mereni.b[0] - mereni.a[0], mereni.b[1] - mereni.a[1]), u = Math.atan2(mereni.b[1] - mereni.a[1], mereni.b[0] - mereni.a[0]) * 180 / Math.PI;
        usecka(mereni.a, mereni.b, `${K.fmt(d, 2)} mm · ${K.fmt(u, 1)}°`);
      }
      if (kalib && kalib.a) usecka(kalib.a, kalib.b || kalib.a, 'kalibrace');
    }

    /* ---------- hledání ---------- */
    function najdiBod(px, py) {
      const sk = skica(); if (!sk.zapnuta) return null;
      const dy = upravuji === 'dolni' && !sk.soumerna ? -posun() : posun();
      let nej = null, d0 = 10;
      body().forEach((b, i) => { const [x, y] = naPx(b[0], b[1] + dy); const d = Math.hypot(x - px, y - py); if (d < d0) { d0 = d; nej = i; } });
      return nej;
    }
    function najdiHranu(mm) {
      const B = body(), dy = upravuji === 'dolni' && !skica().soumerna ? -posun() : posun();
      let nej = 0, d0 = Infinity;
      for (let i = 0; i < B.length; i++) {
        const a = B[i], b = B[(i + 1) % B.length];
        const dx = b[0] - a[0], dyy = b[1] - a[1], l2 = dx * dx + dyy * dyy;
        const t = l2 ? Math.max(0, Math.min(1, ((mm[0] - a[0]) * dx + (mm[1] - dy - a[1]) * dyy) / l2)) : 0;
        const d = Math.hypot(mm[0] - a[0] - t * dx, mm[1] - dy - a[1] - t * dyy);
        if (d < d0) { d0 = d; nej = i; }
      }
      return { i: nej, d: d0 };
    }
    const zaokr = v => (prichytit ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100);
    function pridejBod(mm) {
      if (!skica().zapnuta) { prevezmi(); return; }
      const dy = upravuji === 'dolni' && !skica().soumerna ? -posun() : posun();
      const { i } = najdiHranu(mm);
      zmen(sk => { const B = upravuji === 'dolni' && !sk.soumerna ? sk.dolni : sk.horni; B.splice(i + 1, 0, [zaokr(mm[0]), zaokr(mm[1] - dy)]); });
      vybrany = i + 1;
    }
    function smazBod(i) {
      platnyVyber();
      if (i == null || i >= body().length) return;
      if (body().length <= 3) { Dialog.info('Obrys musí mít aspoň 3 body.'); return; }
      zmen(sk => { (upravuji === 'dolni' && !sk.soumerna ? sk.dolni : sk.horni).splice(i, 1); });
      vybrany = null;
    }

    /* ---------- ovládání ---------- */
    const ukaz = new Map();
    let pinch = null;
    const mistni = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
      const [px, py] = mistni(e), mm = naMm(px, py);
      ukaz.set(e.pointerId, [px, py]);
      if (ukaz.size === 2) { const [a, b] = [...ukaz.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: pohled.s, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; tah = null; return; }
      if (e.button === 2) { const i = najdiBod(px, py); if (i != null) smazBod(i); return; }
      if (nastroj === 'mereni') { mereni = { a: mm, b: mm }; tah = { druh: 'mereni' }; kresli(); return; }
      if (nastroj === 'kalibrace') {
        if (!podklad) { Dialog.info('Nejdřív vložte podklad (fotku kolíčku).'); return; }
        if (!kalib || kalib.b) kalib = { a: mm }; else kalibruj(mm);
        kresli(); return;
      }
      if (nastroj === 'podklad' && podklad) { tah = { druh: 'podklad', start: mm, x: podklad.x, y: podklad.y }; return; }
      if (nastroj === 'pridat') { pridejBod(mm); return; }
      const i = najdiBod(px, py);
      if (i != null) { vybrany = i; tah = { druh: 'bod', i }; kresli(); return; }
      vybrany = null;
      tah = { druh: 'posun', start: [px, py], x0: pohled.x0, y0: pohled.y0 }; kresli();
    });
    cv.addEventListener('pointermove', e => {
      const [px, py] = mistni(e), mm = naMm(px, py);
      if (ukaz.has(e.pointerId)) ukaz.set(e.pointerId, [px, py]);
      if (pinch && ukaz.size === 2) {
        const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const fokus = naMm(...pinch.mid);
        pohled.s = Math.max(0.5, Math.min(80, pinch.s * d / Math.max(1, pinch.d)));
        pohled.x0 = fokus[0] - pinch.mid[0] / pohled.s; pohled.y0 = fokus[1] + pinch.mid[1] / pohled.s;
        kresli(); return;
      }
      cfg.info(`x ${K.fmt(mm[0], 1)} · y ${K.fmt(mm[1], 1)} mm`);
      if (!tah) { const h2 = najdiBod(px, py); if (h2 !== hover) { hover = h2; cv.style.cursor = h2 != null ? 'grab' : nastroj === 'body' ? 'default' : 'crosshair'; kresli(); } return; }
      if (tah.druh === 'posun') { pohled.x0 = tah.x0 - (px - tah.start[0]) / pohled.s; pohled.y0 = tah.y0 + (py - tah.start[1]) / pohled.s; kresli(); }
      else if (tah.druh === 'mereni') { mereni.b = mm; kresli(); }
      else if (tah.druh === 'podklad') { podklad.x = tah.x + mm[0] - tah.start[0]; podklad.y = tah.y + mm[1] - tah.start[1]; kresli(); }
      else if (tah.druh === 'bod') {
        const dy = upravuji === 'dolni' && !skica().soumerna ? -posun() : posun();
        const i = tah.i, x = zaokr(mm[0]), y = zaokr(mm[1] - dy);
        zmen(sk => { const B = upravuji === 'dolni' && !sk.soumerna ? sk.dolni : sk.horni; B[i] = B[i][2] ? [x, y, 1] : [x, y]; }, 'skica-bod');
      }
    });
    const pust = e => {
      ukaz.delete(e.pointerId);
      if (ukaz.size < 2) pinch = null;
      if (tah && tah.druh === 'podklad') ulozPodklad();
      tah = null;
    };
    cv.addEventListener('pointerup', pust); cv.addEventListener('pointercancel', pust);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('dblclick', e => {
      const [px, py] = mistni(e), i = najdiBod(px, py);
      if (i != null) { zmen(sk => { const B = upravuji === 'dolni' && !sk.soumerna ? sk.dolni : sk.horni; B[i] = B[i][2] ? [B[i][0], B[i][1]] : [B[i][0], B[i][1], 1]; }); return; }
      if (skica().zapnuta) { const mm = naMm(px, py), hr = najdiHranu(mm); if (hr.d * pohled.s < 14) pridejBod(mm); }
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const [px, py] = mistni(e), f = naMm(px, py);
      if (nastroj === 'podklad' && podklad && e.altKey) { podklad.uhel += e.deltaY > 0 ? -0.5 : 0.5; kresli(); ulozPodklad(); naPodklad(); return; }
      pohled.s = Math.max(0.5, Math.min(80, pohled.s * Math.exp(-e.deltaY * 0.0015)));
      pohled.x0 = f[0] - px / pohled.s; pohled.y0 = f[1] + py / pohled.s;
      kresli();
    }, { passive: false });
    cv.tabIndex = 0;
    cv.addEventListener('keydown', e => {
      platnyVyber();
      if (e.key === 'Escape' && (mereni || kalib || vybrany != null)) { mereni = null; kalib = null; vybrany = null; kresli(); return; }
      // Tab / Shift+Tab nad vybraným bodem přepíná body (výběr bez myši); bez výběru Tab normálně opouští plátno
      if (e.key === 'Tab' && vybrany != null) { e.preventDefault(); const n = body().length; vybrany = (vybrany + (e.shiftKey ? n - 1 : 1)) % n; kresli(); return; }
      if (e.key === 'Enter' && vybrany == null && body().length) { e.preventDefault(); vybrany = 0; kresli(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && vybrany != null) { e.preventDefault(); smazBod(vybrany); return; }
      const sm = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (sm && vybrany != null) {
        e.preventDefault();
        const k = e.shiftKey ? 1 : 0.1, i = vybrany;
        zmen(sk => { const B = upravuji === 'dolni' && !sk.soumerna ? sk.dolni : sk.horni; B[i][0] = Math.round((B[i][0] + sm[0] * k) * 100) / 100; B[i][1] = Math.round((B[i][1] + sm[1] * k) * 100) / 100; }, 'skica-klavesa');
      }
    });
    new ResizeObserver(() => kresli()).observe(cv);

    /* ---------- podklad ---------- */
    // zápis celé fotky (MB) odložený – posuvník a kolečko nezahltí IndexedDB
    let ulozCas = null;
    function ulozPodklad(hned) {
      clearTimeout(ulozCas);
      const pis = () => {
        if (!podklad) return dbPis('obr', null);
        const { data, x, y, mmNaPx, uhel, pruhlednost } = podklad;
        return dbPis('obr', { data, x, y, mmNaPx, uhel, pruhlednost });
      };
      if (hned) return pis();
      return new Promise(ok => { ulozCas = setTimeout(() => pis().then(ok), 300); });
    }
    function nactiObr(h) {
      return new Promise(ok => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => ok(null); img.src = h.data; });
    }
    async function vlozPodklad(soubor) {
      const data = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r.readAsDataURL(soubor); });
      const img = await nactiObr({ data });
      if (!img) { Dialog.chyba('Obrázek nejde načíst.'); return; }
      const o = st().o, delka = o ? o.L : 72;
      // výchozí měřítko: šířka obrázku = 1,3 × délka kolíčku; pak kalibrovat
      podklad = { img, data, mmNaPx: delka * 1.3 / img.width, uhel: 0, pruhlednost: 0.5, x: -delka * 0.15, y: img.height * delka * 1.3 / img.width / 2 };
      await ulozPodklad(true);
      kresli(); naPodklad();
    }
    async function kalibruj(b) {
      kalib.b = b; kresli();
      const d = Math.hypot(b[0] - kalib.a[0], b[1] - kalib.a[1]);
      if (d < 0.01) { kalib = null; return; }
      const odp = await Dialog.zeptej(`Na fotce je mezi body ${K.fmt(d, 1)} mm. Kolik je to ve skutečnosti (mm)?`, K.fmt(d, 1));
      const sk = K.cislo(odp, NaN);
      if (Number.isFinite(sk) && sk > 0) {
        const f = sk / d;
        // měřítko kolem prvního bodu, aby zůstal na místě
        podklad.x = kalib.a[0] + (podklad.x - kalib.a[0]) * f; podklad.y = kalib.a[1] + (podklad.y - kalib.a[1]) * f;
        podklad.mmNaPx *= f;
        await ulozPodklad(true);
      }
      kalib = null; kresli();
    }
    dbCti('obr').then(async h => { if (h && h.data) { const img = await nactiObr(h); if (img && !podklad) { podklad = Object.assign({ img }, h); kresli(); naPodklad(); } } });

    return {
      kresli, prizpusob, prevezmi, vlozPodklad, naPx,
      nastroj(n) { nastroj = n; mereni = null; kalib = null; cv.style.cursor = n === 'body' ? 'default' : 'crosshair'; kresli(); },
      aktivuj(a) { aktivni = a; if (a) { velikost(); kresli(); } },
      prichytit(a) { prichytit = a; },
      upravuj(jm) { upravuji = jm; vybrany = null; kresli(); },
      get upravuji() { return upravuji; },
      podklad: {
        get je() { return !!podklad; },
        nastav(co, h) { if (!podklad) return; podklad[co] = h; kresli(); ulozPodklad(); },
        hodnota(co) { return podklad ? podklad[co] : null; },
        async smaz() { podklad = null; await ulozPodklad(true); kresli(); naPodklad(); },
      },
      smazVybrany() { smazBod(vybrany); },
      zrusVyber() { vybrany = null; hover = null; if (tah && tah.druh === 'bod') tah = null; kresli(); },
    };
  }
  window.KOLICKY_SKICAR = { vytvor };
})();
