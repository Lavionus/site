/* Porovnání před a po – ovládání stránky (DOM). Výpočty jsou v jadro.js (PredPoJadro). */
(function () {
  'use strict';
  const J = window.PredPoJadro;
  const $ = id => document.getElementById(id);
  const t = s => (window.I18N && I18N.t ? I18N.t(s) : s);
  const LS = 'webapp_pred_po_nastaveni';
  const DB_JMENO = 'webapp_pred_po';
  const MAX_STRANA = 3200;          // větší fotky se pro práci zmenší (paměť, rychlost)
  const MAX_ANALYZA = 1e6;          // metriky na zmenšenině do 1 Mpx
  const BARVY_BODU = ['#ff4d4d', '#2ecc71', '#3d8bff', '#ffb300', '#d65cff', '#00c2c7', '#ff7f50', '#9acd32'];

  // ---------- stav ----------
  const S = {
    rezim: 'posuvnik', smer: 'svisle', poloha: 0.5, pruhlednost: 50, rozdil: 'zmeny', zesileni: 4, prah: 24,
    blikInterval: 600, lupaZoom: 2, lupaVel: 160, lupaPul: false,
    popisky: true, popisA: t('Před'), popisB: t('Po'),
    zpusob: 'natahnout', dol: { dx: 0, dy: 0, s: 1, u: 0 }, body: [], model: 'auto', pouzitBody: true, orez: false
  };
  const NASTAVENI = ['rezim', 'smer', 'pruhlednost', 'rozdil', 'zesileni', 'prah', 'blikInterval', 'lupaZoom', 'lupaVel', 'lupaPul', 'popisky'];
  const OBR = { A: null, B: null };         // { c: canvas, nazev, blob }
  let M = J.JEDNOTKOVA, ram = null, PA = null, PB = null, verze = 0;
  let cache = {};                             // data obrázků a rozdílu podle verze
  const V = { s: 1, ox: 0, oy: 0 }, VA = { s: 1, ox: 0, oy: 0 }, VB = { s: 1, ox: 0, oy: 0 };
  let lupa = null, blikB = false, blikTimer = null, blikPauza = false, prohozeno = false;

  try { Object.assign(S, JSON.parse(localStorage.getItem(LS) || '{}')); } catch { /* výchozí */ }
  if (S.rezim === 'body') S.rezim = 'posuvnik';
  function ulozNastaveni() {
    const o = {}; for (const k of NASTAVENI) o[k] = S[k];
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch { /* plné úložiště */ }
  }

  // ---------- IndexedDB: poslední dvojice ----------
  function db() {
    return new Promise((ok, chyba) => {
      const r = indexedDB.open(DB_JMENO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('projekt');
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
  }
  async function idb(akce, hodnota) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const tx = d.transaction('projekt', akce === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('projekt');
      const r = akce === 'get' ? st.get('posledni') : akce === 'put' ? st.put(hodnota, 'posledni') : st.delete('posledni');
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
  }
  let ulozTimer = null;
  function ulozProjekt() {
    clearTimeout(ulozTimer);
    ulozTimer = setTimeout(() => {
      if (!OBR.A && !OBR.B) { idb('del').catch(() => {}); return; }
      idb('put', {
        a: OBR.A && OBR.A.blob, b: OBR.B && OBR.B.blob, nazevA: OBR.A && OBR.A.nazev, nazevB: OBR.B && OBR.B.nazev,
        body: S.body, dol: S.dol, zpusob: S.zpusob, model: S.model, pouzitBody: S.pouzitBody, orez: S.orez,
        popisA: S.popisA, popisB: S.popisB, poloha: S.poloha
      }).catch(() => {});
    }, 400);
  }

  // ---------- načítání obrázků ----------
  async function obrazekZBlobu(blob) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const k = Math.min(1, MAX_STRANA / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, c.width, c.height);
    c.puvodni = { w: bmp.width, h: bmp.height };
    bmp.close && bmp.close();
    return c;
  }

  async function nastavObrazek(slot, blob, nazev, tiche) {
    try {
      const c = await obrazekZBlobu(blob);
      if (OBR[slot] && (OBR[slot].c.width !== c.width || OBR[slot].c.height !== c.height)) S.body = [];   // body by neseděly
      OBR[slot] = { c, nazev: nazev || slot, blob };
      if (!tiche) { prestav(true); ulozProjekt(); }
    } catch (e) {
      Dialog.chyba(t('Obrázek se nepodařilo načíst') + ' (' + (nazev || '') + ').');
    }
  }

  async function nactiSoubory(soubory, slot) {
    const obr = [...soubory].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(f.name));
    if (!obr.length) { Dialog.chyba(t('Vyberte soubor s obrázkem.')); return; }
    if (obr.length >= 2 && !slot) {
      obr.sort((a, b) => a.lastModified - b.lastModified);   // starší = před
      await nastavObrazek('A', obr[0], obr[0].name, true);
      await nastavObrazek('B', obr[1], obr[1].name, true);
      S.body = []; prestav(true); ulozProjekt(); return;
    }
    await nastavObrazek(slot || (!OBR.A ? 'A' : 'B'), obr[0], obr[0].name);
  }

  // ---------- příprava rámu (B převedené do rámu A) ----------
  function vysledekBodu() {
    if (!OBR.A || !OBR.B) return null;
    return J.zBodu(S.body.filter(p => p.a && p.b), S.model);
  }

  function prestav(vejit) {
    const a = OBR.A, b = OBR.B;
    $('prazdno').hidden = !!(a && b);
    for (const k of ['A', 'B']) {
      const sl = $('slot' + k); sl.classList.toggle('ma', !!OBR[k]);
      sl.querySelector('.jm').textContent = OBR[k] ? '✓ ' + OBR[k].nazev : '';
    }
    if (!a || !b) { PA = PB = null; kresli(); aktualizujPanel(); return; }
    const wA = a.c.width, hA = a.c.height, wB = b.c.width, hB = b.c.height;
    const vb = S.pouzitBody ? vysledekBodu() : null;
    const zaklad = vb ? vb.M : J.zakladni(wA, hA, wB, hB, S.zpusob);
    M = J.slozit(J.doladeni(wA / 2, hA / 2, S.dol.dx, S.dol.dy, S.dol.s, S.dol.u), zaklad);
    ram = (S.orez && J.spolecnaPlocha(M, wA, hA, wB, hB)) || { x: 0, y: 0, w: wA, h: hA };
    PA = document.createElement('canvas'); PA.width = ram.w; PA.height = ram.h;
    PA.getContext('2d').drawImage(a.c, -ram.x, -ram.y);
    PB = document.createElement('canvas'); PB.width = ram.w; PB.height = ram.h;
    const g = PB.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.setTransform(...J.slozit([1, 0, 0, 1, -ram.x, -ram.y], M));
    g.drawImage(b.c, 0, 0);
    verze++; cache = {};
    if (vejit) { velikostPlatna(); vejitVse(); }
    kresli(); aktualizujPanel();
  }

  const zdrojA = () => prohozeno ? PB : PA, zdrojB = () => prohozeno ? PA : PB;
  const popisek = k => S.popisky ? ((k === 'A') !== prohozeno ? S.popisA : S.popisB) : '';

  function dataPlatna(c) { return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); }
  function data(klic, c) { return cache[klic] || (cache[klic] = dataPlatna(c)); }

  // ---------- zobrazení ----------
  const c1 = $('c1'), c2 = $('c2'), plocha = $('plocha');
  let dpr = 1;
  function velikostPlatna() {
    dpr = window.devicePixelRatio || 1;
    for (const c of [c1, c2]) {
      const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }
  }
  function vejitDo(v, w, h, c) {
    const cw = c.clientWidth, ch = c.clientHeight;
    v.s = Math.min(cw / w, ch / h) * 0.98 || 1;
    v.ox = (cw - w * v.s) / 2; v.oy = (ch - h * v.s) / 2;
  }
  function vejitVse() {
    if (S.rezim === 'body') { if (OBR.A) vejitDo(VA, OBR.A.c.width, OBR.A.c.height, c1); if (OBR.B) vejitDo(VB, OBR.B.c.width, OBR.B.c.height, c2); }
    else if (PA) vejitDo(V, PA.width, PA.height, c1);
  }
  function zoom(v, f, px, py) {
    const s = Math.max(0.02, Math.min(64, v.s * f));
    v.ox = px - (px - v.ox) * s / v.s; v.oy = py - (py - v.oy) * s / v.s; v.s = s;
  }

  function priprav(c, v) {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.ox, dpr * v.oy);
    g.imageSmoothingEnabled = v.s < 3; g.imageSmoothingQuality = 'high';
    return g;
  }
  function stitek(g, text, x, y, zarovnani, velikost) {
    if (!text) return;
    const f = velikost || 13 * dpr;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `600 ${f}px system-ui, sans-serif`; g.textBaseline = 'middle';
    const w = g.measureText(text).width + f, h = f * 1.7;
    const x0 = zarovnani === 'vpravo' ? x - w : x;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.roundRect ? g.roundRect(x0, y, w, h, f * 0.3) : g.rect(x0, y, w, h); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, x0 + f / 2, y + h / 2);
    g.restore();
  }
  // viditelná část obrázku na plátně (v px plátna)
  function oblast(c, v, w, h) {
    const x0 = Math.max(0, v.ox * dpr), y0 = Math.max(0, v.oy * dpr);
    return { x0, y0, x1: Math.min(c.width, (v.ox + w * v.s) * dpr), y1: Math.min(c.height, (v.oy + h * v.s) * dpr) };
  }

  function kresli() {
    if (!c1.width) velikostPlatna();
    plocha.className = 'plocha ' + S.rezim + (S.smer === 'vodorovne' ? ' vodorovne' : '') +
      (S.rezim === 'vedle' || S.rezim === 'body' ? ' dva' : '') + (plocha.clientWidth < plocha.clientHeight * 1.1 ? ' nadsebou' : '');
    $('napis').hidden = true;
    if (S.rezim === 'body') return kresliBody();
    const A = zdrojA(), B = zdrojB();
    if (!A) { for (const c of [c1, c2]) c.getContext('2d').clearRect(0, 0, c.width, c.height); return; }
    const w = A.width, h = A.height, g = priprav(c1, V), o = oblast(c1, V, w, h), m = 8 * dpr;
    switch (S.rezim) {
      case 'posuvnik': {
        g.drawImage(A, 0, 0);
        g.save(); g.beginPath();
        if (S.smer === 'svisle') g.rect(w * S.poloha, 0, w * (1 - S.poloha), h); else g.rect(0, h * S.poloha, w, h * (1 - S.poloha));
        g.clip(); g.drawImage(B, 0, 0); g.restore();
        g.setTransform(1, 0, 0, 1, 0, 0);
        const svisle = S.smer === 'svisle';
        const p = svisle ? (V.ox + w * S.poloha * V.s) * dpr : (V.oy + h * S.poloha * V.s) * dpr;
        g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 4 * dpr;
        if (svisle) g.fillRect(p - dpr, o.y0, 2 * dpr, o.y1 - o.y0); else g.fillRect(o.x0, p - dpr, o.x1 - o.x0, 2 * dpr);
        const cx = svisle ? p : (o.x0 + o.x1) / 2, cy = svisle ? (o.y0 + o.y1) / 2 : p;
        uchyt(g, cx, cy, 18 * dpr, svisle);
        stitek(g, popisek('A'), o.x0 + m, o.y0 + m);
        if (svisle) stitek(g, popisek('B'), o.x1 - m, o.y0 + m, 'vpravo'); else stitek(g, popisek('B'), o.x0 + m, o.y1 - m - 22 * dpr);
        break;
      }
      case 'lupa': {
        g.drawImage(A, 0, 0);
        stitek(g, popisek('A'), o.x0 + m, o.y0 + m);
        if (!lupa) lupa = { x: c1.clientWidth / 2, y: c1.clientHeight / 2 };
        const r = S.lupaVel / 2, k = S.lupaZoom;
        g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.beginPath(); g.arc(lupa.x, lupa.y, r, 0, Math.PI * 2); g.clip();
        g.fillStyle = '#000'; g.fillRect(lupa.x - r, lupa.y - r, 2 * r, 2 * r);
        // bod obrázku pod kurzorem zůstává pod kurzorem i při zvětšení
        const ix = (lupa.x - V.ox) / V.s, iy = (lupa.y - V.oy) / V.s, s2 = V.s * k;
        g.imageSmoothingEnabled = s2 < 3;
        g.setTransform(dpr * s2, 0, 0, dpr * s2, dpr * (lupa.x - ix * s2), dpr * (lupa.y - iy * s2));
        if (S.lupaPul) {
          g.drawImage(A, 0, 0);
          g.beginPath(); g.rect(ix, -1e6, 2e6, 2e6); g.clip();
        }
        g.drawImage(B, 0, 0);
        g.restore();
        g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 4;
        g.beginPath(); g.arc(lupa.x, lupa.y, r, 0, Math.PI * 2); g.stroke();
        if (S.lupaPul) { g.beginPath(); g.moveTo(lupa.x, lupa.y - r); g.lineTo(lupa.x, lupa.y + r); g.stroke(); }
        g.restore();
        stitek(g, (S.lupaPul ? popisek('A') + ' | ' : '') + popisek('B') + (k !== 1 ? ' ×' + k : ''), (lupa.x - r * 0.7) * dpr, (lupa.y + r + 6) * dpr, null, 11 * dpr);
        break;
      }
      case 'vedle': {
        g.drawImage(A, 0, 0); stitek(g, popisek('A'), o.x0 + m, o.y0 + m);
        const g2 = priprav(c2, V), o2 = oblast(c2, V, w, h);
        g2.drawImage(B, 0, 0); stitek(g2, popisek('B'), o2.x0 + m, o2.y0 + m);
        break;
      }
      case 'prolnuti': {
        g.drawImage(A, 0, 0); g.globalAlpha = S.pruhlednost / 100; g.drawImage(B, 0, 0); g.globalAlpha = 1;
        stitek(g, popisek('A') + ' ' + (100 - S.pruhlednost) + ' % · ' + popisek('B') + ' ' + S.pruhlednost + ' %', o.x0 + m, o.y0 + m);
        break;
      }
      case 'rozdil': {
        const d = obrazRozdilu();
        if (d) g.drawImage(d, 0, 0, w, h);
        stitek(g, { zmeny: t('Změny nad prahem'), abs: '|A − B| ×' + S.zesileni, heat: t('Heat-mapa') + ' ×' + S.zesileni, ssim: '1 − SSIM' }[S.rozdil], o.x0 + m, o.y0 + m);
        break;
      }
      case 'blikani': {
        g.drawImage(blikB ? B : A, 0, 0);
        stitek(g, (blikB ? popisek('B') || 'B' : popisek('A') || 'A') + (blikPauza ? ' ⏸' : ''), o.x0 + m, o.y0 + m, null, 15 * dpr);
        break;
      }
    }
  }
  function uchyt(g, x, y, r, svisle) {
    g.save(); g.shadowBlur = 5 * dpr;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.shadowBlur = 0; g.fillStyle = '#fff';
    const s = r * 0.42;
    for (const z of [-1, 1]) {
      g.beginPath();
      if (svisle) { g.moveTo(x + z * r * 0.62, y); g.lineTo(x + z * (r * 0.62 - s), y - s); g.lineTo(x + z * (r * 0.62 - s), y + s); }
      else { g.moveTo(x, y + z * r * 0.62); g.lineTo(x - s, y + z * (r * 0.62 - s)); g.lineTo(x + s, y + z * (r * 0.62 - s)); }
      g.fill();
    }
    g.restore();
  }

  // ---------- rozdíl a metriky ----------
  function zmensenina(c, k) {
    const z = document.createElement('canvas');
    z.width = Math.max(1, Math.round(c.width * k)); z.height = Math.max(1, Math.round(c.height * k));
    const g = z.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, z.width, z.height);
    return z;
  }
  function analyza() {
    if (cache.analyza) return cache.analyza;
    const k = Math.min(1, Math.sqrt(MAX_ANALYZA / (PA.width * PA.height)));
    const a = dataPlatna(zmensenina(PA, k)), b = dataPlatna(zmensenina(PB, k));
    const A = { sirka: a.width, vyska: a.height, data: a.data }, B = { sirka: b.width, vyska: b.height, data: b.data };
    return (cache.analyza = Object.assign(J.metriky(A, B, S.prah), { A, B, k, prah: S.prah }));
  }
  function obrazRozdilu() {
    const klic = 'rozdil|' + S.rozdil + '|' + S.zesileni + '|' + S.prah + '|' + prohozeno;
    if (cache[klic]) return cache[klic];
    let obr;
    if (S.rozdil === 'ssim') {
      const an = analyza(); obr = J.obrazSsim(an.ssimMapa, an.A.sirka, an.A.vyska, an.maska);
    } else {
      const a = data('a', PA), b = data('b', PB);
      const A = { sirka: a.width, vyska: a.height, data: a.data }, B = { sirka: b.width, vyska: b.height, data: b.data };
      obr = J.rozdil(prohozeno ? B : A, prohozeno ? A : B, { rezim: S.rozdil, zesileni: S.zesileni, prah: S.prah, maska: cache.maska || (cache.maska = J.maska(A, B)) }).obr;
    }
    for (const k of Object.keys(cache)) if (k.startsWith('rozdil|')) delete cache[k];   // jen jeden rozdíl v paměti
    const c = document.createElement('canvas'); c.width = obr.sirka; c.height = obr.vyska;
    c.getContext('2d').putImageData(new ImageData(obr.data, obr.sirka, obr.vyska), 0, 0);
    return (cache[klic] = c);
  }
  function ukazMetriky() {
    const el = $('metriky');
    if (!PA) { el.innerHTML = ''; return; }
    const an = analyza();
    if (an.prah !== S.prah) { const r = J.rozdil(an.A, an.B, { prah: S.prah, maska: an.maska }); an.zmeneno = r.zmeneno; an.prah = S.prah; }
    const cislo = (x, d) => isFinite(x) ? x.toLocaleString(document.documentElement.lang || 'cs', { maximumFractionDigits: d, minimumFractionDigits: d }) : '∞';
    el.innerHTML = `<div><b>${cislo(an.psnr, 2)} dB</b><span>PSNR</span></div><div><b>${cislo(an.ssim, 4)}</b><span>SSIM</span></div>` +
      `<div><b>${cislo(an.mse, 1)}</b><span>MSE</span></div><div><b>${cislo(an.zmeneno * 100, 1)} %</b><span>${t('změněno nad prahem')}</span></div>` +
      (an.pokryti < 0.999 ? `<div style="grid-column:1/-1"><span>${t('Společná plocha')}: ${cislo(an.pokryti * 100, 1)} %</span></div>` : '');
  }

  // ---------- zarovnání podle bodů ----------
  function kresliBody() {
    const r = vysledekBodu();
    $('napis').hidden = false;
    $('napis').textContent = !OBR.A || !OBR.B ? t('Načtěte oba obrázky.') : nabidkaBodu();
    for (const [c, v, k] of [[c1, VA, 'a'], [c2, VB, 'b']]) {
      const o = OBR[k.toUpperCase()];
      const g = priprav(c, v);
      if (!o) continue;
      g.drawImage(o.c, 0, 0);
      const ob = oblast(c, v, o.c.width, o.c.height);
      stitek(g, (k === 'a' ? 'A ' + S.popisA : 'B ' + S.popisB), ob.x0 + 8 * dpr, ob.y1 - 32 * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      S.body.forEach((p, i) => {
        if (!p[k]) return;
        const x = v.ox + p[k].x * v.s, y = v.oy + p[k].y * v.s;
        g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.moveTo(x - 15, y); g.lineTo(x + 15, y); g.moveTo(x, y - 15); g.lineTo(x, y + 15); g.stroke();
        g.strokeStyle = BARVY_BODU[i % BARVY_BODU.length]; g.lineWidth = 1.6; g.stroke();
        g.font = '700 12px system-ui, sans-serif'; g.fillStyle = '#000'; g.fillText(i + 1, x + 11, y - 9); g.fillStyle = BARVY_BODU[i % BARVY_BODU.length]; g.fillText(i + 1, x + 10, y - 10);
        // kam bod B padne po transformaci (kontrola chyby)
        if (k === 'a' && r && p.b) {
          const q = J.pouzij(r.M, p.b.x, p.b.y), qx = v.ox + q.x * v.s, qy = v.oy + q.y * v.s;
          g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(qx, qy); g.stroke();
          g.beginPath(); g.arc(qx, qy, 3, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
        }
      });
    }
  }
  function nabidkaBodu() {
    const ceka = S.body.find(p => !p.a || !p.b);
    if (ceka) return ceka.a ? t('Teď klepněte na stejný bod v B (vpravo).') : t('Teď klepněte na stejný bod v A (vlevo).');
    return S.body.length ? t('Přidejte další pár: bod v A, pak v B.') : t('Klepněte na výrazný bod v A (roh, okno, kámen).');
  }
  function pridejBod(k, x, y) {
    let p = S.body.find(q => !q[k]);
    if (!p) { if (S.body.length >= 8) { Dialog.info(t('Nejvýše 8 párů bodů.')); return; } p = {}; S.body.push(p); }
    p[k] = { x, y };
    zmenaBodu();
  }
  function zmenaBodu() { prestav(); ulozProjekt(); }

  // ---------- ovládání myší a dotykem ----------
  function prevodNaObr(v, e, c) { const b = c.getBoundingClientRect(); const x = e.clientX - b.left, y = e.clientY - b.top; return { x, y, ix: (x - v.ox) / v.s, iy: (y - v.oy) / v.s }; }

  function ovladani(c, ktery) {
    const ukazatele = new Map();
    let akce = null;
    const pohled = () => S.rezim === 'body' ? (ktery === 1 ? VA : VB) : V;
    c.addEventListener('wheel', e => {
      if (!PA && S.rezim !== 'body') return;
      e.preventDefault();
      const p = prevodNaObr(pohled(), e, c);
      zoom(pohled(), Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), p.x, p.y);
      kresli();
    }, { passive: false });
    c.addEventListener('pointerdown', e => {
      if (!PA && S.rezim !== 'body') return;
      c.setPointerCapture(e.pointerId);
      ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = pohled(), p = prevodNaObr(v, e, c);
      if (ukazatele.size === 2) { akce = { typ: 'stisk', ...stredStisku(ukazatele), s0: v.s }; return; }
      akce = { typ: 'posun', x0: e.clientX, y0: e.clientY, ox: v.ox, oy: v.oy, pohnuto: false };
      const posunout = e.button === 1 || e.button === 2 || e.shiftKey || mezernik;
      if (S.rezim === 'posuvnik' && !posunout) { akce = { typ: 'poloha' }; nastavPolohu(p); }
      else if (S.rezim === 'body' && !posunout) {
        const k = ktery === 1 ? 'a' : 'b';
        const i = S.body.findIndex(q => q[k] && Math.hypot((q[k].x - p.ix) * v.s, (q[k].y - p.iy) * v.s) < 14);
        akce = i >= 0 ? { typ: 'bod', i, k } : Object.assign(akce, { klik: k });
      }
    });
    c.addEventListener('pointermove', e => {
      const v = pohled();
      if (S.rezim === 'lupa' && ukazatele.size < 2) {
        const p = prevodNaObr(v, e, c); lupa = { x: p.x, y: p.y };
        // dotykem tažení posouvá lupu, myší tažení posouvá obraz
        if (!akce || e.pointerType !== 'mouse') { kresli(); return; }
      }
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!akce) return;
      if (akce.typ === 'stisk') {
        if (ukazatele.size < 2) return;
        const st = stredStisku(ukazatele), b = c.getBoundingClientRect();
        zoom(v, st.d / akce.d * akce.s0 / v.s, st.x - b.left, st.y - b.top);
        v.ox += st.x - akce.x; v.oy += st.y - akce.y; akce.x = st.x; akce.y = st.y;
      } else if (akce.typ === 'poloha') nastavPolohu(prevodNaObr(v, e, c));
      else if (akce.typ === 'bod') {
        const p = prevodNaObr(v, e, c), o = OBR[akce.k.toUpperCase()].c;
        S.body[akce.i][akce.k] = { x: Math.max(0, Math.min(o.width, p.ix)), y: Math.max(0, Math.min(o.height, p.iy)) };
        prestav();
        return;
      } else if (akce.typ === 'posun') {
        const dx = e.clientX - akce.x0, dy = e.clientY - akce.y0;
        if (!akce.pohnuto && Math.hypot(dx, dy) < 5) return;
        akce.pohnuto = true; plocha.classList.add('tah');
        v.ox = akce.ox + dx; v.oy = akce.oy + dy;
      }
      kresli(); if (akce.pohnuto) plocha.classList.add('tah');
    });
    const konec = e => {
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.delete(e.pointerId);
      if (akce && akce.typ === 'posun' && !akce.pohnuto && e.type === 'pointerup') {
        if (akce.klik) { const p = prevodNaObr(pohled(), e, c), o = OBR[akce.klik.toUpperCase()]; if (o && p.ix >= 0 && p.iy >= 0 && p.ix <= o.c.width && p.iy <= o.c.height) pridejBod(akce.klik, p.ix, p.iy); }
        else if (S.rezim === 'blikani') prepniBlik();
      }
      if (akce && akce.typ === 'bod') ulozProjekt();
      if (akce && akce.typ === 'poloha') ulozProjekt();
      akce = ukazatele.size === 1 ? null : akce && akce.typ === 'stisk' ? null : akce;
      if (!ukazatele.size) { akce = null; plocha.classList.remove('tah'); }
    };
    c.addEventListener('pointerup', konec); c.addEventListener('pointercancel', konec);
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('dblclick', () => {
      const v = pohled(); const o = OBR[ktery === 1 ? 'A' : 'B'], w = S.rezim === 'body' ? o && o.c : PA;
      if (!w) return;
      const s = v.s; vejitDo(v, w.width, w.height, c);
      if (Math.abs(s - v.s) < 1e-3) { zoom(v, 1 / v.s, c.clientWidth / 2, c.clientHeight / 2); }
      kresli();
    });
  }
  function stredStisku(u) { const [a, b] = [...u.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; }
  function nastavPolohu(p) {
    if (!PA) return;
    S.poloha = Math.max(0, Math.min(1, S.smer === 'svisle' ? p.ix / PA.width : p.iy / PA.height));
    kresli(); $('poloha').value = S.poloha * 100; $('polohaV').textContent = Math.round(S.poloha * 100) + ' %';
  }
  let mezernik = false;
  ovladani(c1, 1); ovladani(c2, 2);

  // ---------- blikání ----------
  function prepniBlik() { blikB = !blikB; kresli(); }
  function nastavBlikani() {
    clearInterval(blikTimer); blikTimer = null;
    if (S.rezim === 'blikani' && !blikPauza && PA) blikTimer = setInterval(prepniBlik, S.blikInterval);
    $('blikPauza').textContent = blikPauza ? t('▶ Pokračovat') : t('⏸ Pozastavit');
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInterval(blikTimer); blikTimer = null; } else nastavBlikani(); });

  // ---------- panel ----------
  function nastavRezim(r) {
    if (r === 'body' && (!OBR.A || !OBR.B)) { Dialog.info(t('Nejdřív načtěte oba obrázky.')); return; }
    const z = S.rezim; S.rezim = r;
    if (r === 'body' || z === 'body' || r === 'vedle' || z === 'vedle') {
      kresli(); velikostPlatna();
      if (r === 'body' || z === 'body') vejitVse();
      else if (PA) vejitDo(V, PA.width, PA.height, c1);
    }
    if (r === 'body') S.pouzitBody = true;
    ulozNastaveni(); nastavBlikani(); kresli(); aktualizujPanel();
  }
  function aktualizujPanel() {
    document.querySelectorAll('[data-rezim]').forEach(b => b.matches('.tl') && b.setAttribute('aria-pressed', b.dataset.rezim === S.rezim));
    document.querySelectorAll('[data-pro]').forEach(s => { s.hidden = s.dataset.pro !== S.rezim; });
    document.querySelectorAll('[data-smer]').forEach(b => b.setAttribute('aria-pressed', b.dataset.smer === S.smer));
    document.querySelectorAll('[data-rozdil]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rozdil === S.rozdil));
    const hod = (id, v, txt) => { $(id).value = v; if ($(id + 'V')) $(id + 'V').textContent = txt; };
    hod('poloha', S.poloha * 100, Math.round(S.poloha * 100) + ' %');
    hod('lupaZoom', S.lupaZoom, '×' + S.lupaZoom); hod('lupaVel', S.lupaVel, S.lupaVel + ' px');
    $('lupaPul').checked = S.lupaPul;
    hod('pruhlednost', S.pruhlednost, S.pruhlednost + ' %');
    hod('zesileni', S.zesileni, '×' + S.zesileni); hod('prah', S.prah, String(S.prah));
    $('poleZesileni').hidden = !(S.rozdil === 'abs' || S.rozdil === 'heat'); $('polePrah').hidden = S.rozdil !== 'zmeny';
    hod('blikInterval', S.blikInterval, S.blikInterval + ' ms');
    $('popisky').checked = S.popisky;
    if (document.activeElement !== $('popisA')) $('popisA').value = S.popisA;
    if (document.activeElement !== $('popisB')) $('popisB').value = S.popisB;
    $('zpusob').value = S.zpusob; $('orez').checked = S.orez; $('orezStav').textContent = S.orez ? '✓' : '';
    for (const [id, v] of [['dolDx', S.dol.dx], ['dolDy', S.dol.dy]]) { const r = Math.max(200, Math.ceil(Math.abs(v) / 50) * 50 + 50); $(id).min = -r; $(id).max = r; }
    hod('dolDx', S.dol.dx, S.dol.dx.toFixed(1) + ' px'); hod('dolDy', S.dol.dy, S.dol.dy.toFixed(1) + ' px');
    hod('dolS', S.dol.s * 100, (S.dol.s * 100).toFixed(1) + ' %'); hod('dolU', S.dol.u, S.dol.u.toFixed(1) + ' °');
    $('model').value = S.model; $('pouzitBody').checked = S.pouzitBody;
    // body
    $('pary').innerHTML = S.body.map((p, i) => `<div><span class="tecka" style="background:${BARVY_BODU[i % BARVY_BODU.length]}"></span>` +
      `<span class="vlevo">${i + 1}. A ${p.a ? Math.round(p.a.x) + ', ' + Math.round(p.a.y) : '–'} · B ${p.b ? Math.round(p.b.x) + ', ' + Math.round(p.b.y) : '–'}</span>` +
      `<button class="btn mini" data-smaz-bod="${i}" aria-label="${t('Smazat pár')} ${i + 1}">✕</button></div>`).join('');
    const r = vysledekBodu(), vb = $('vysledekBody');
    const uplnych = S.body.filter(p => p.a && p.b).length;
    vb.classList.toggle('spatne', !r && uplnych > 0 || (r && r.rms > 3));
    if (r) {
      const d = J.popis(r.M), nm = { posun: t('posun'), podobnost: t('posun + měřítko + otočení'), afinni: t('afinní') }[r.model];
      vb.innerHTML = `${t('Model')}: <b>${nm}</b> (${uplnych} ${t('párů')})<br>${t('Měřítko')} ${(d.meritko * 100).toFixed(2)} %, ${t('otočení')} ${d.uhel.toFixed(2)} °` +
        `<br>${t('Chyba')} RMS ${r.rms.toFixed(2)} px` + (r.rms > 3 ? ' – ' + t('zkontrolujte body nebo zvolte jiný model') : '');
    } else vb.textContent = uplnych ? t('Na zvolený model je párů málo (podobnost ≥ 2, afinní ≥ 3) nebo leží na přímce.') : t('Zatím žádný úplný pár.');
    // info
    if (OBR.A && OBR.B && PA) {
      const pu = c => c.puvodni && (c.puvodni.w !== c.width) ? ` (${t('původně')} ${c.puvodni.w}×${c.puvodni.h})` : '';
      $('infoObr').textContent = `A ${OBR.A.c.width}×${OBR.A.c.height}${pu(OBR.A.c)} · B ${OBR.B.c.width}×${OBR.B.c.height}${pu(OBR.B.c)} · ${t('rám')} ${PA.width}×${PA.height}`;
    } else $('infoObr').textContent = '';
    document.querySelectorAll('[data-prikaz^="ex"], [data-nabidka="nabExport"]').forEach(b => { b.disabled = !PA; });
    if (S.rezim === 'rozdil') setTimeout(ukazMetriky, 0);
  }

  function svazPosuvnik(id, fn, uloz) {
    $(id).addEventListener('input', () => { fn(+$(id).value); aktualizujPanel(); kresli(); });
    if (uloz) $(id).addEventListener('change', uloz);
  }
  svazPosuvnik('poloha', v => { S.poloha = v / 100; }, ulozProjekt);
  svazPosuvnik('lupaZoom', v => { S.lupaZoom = v; }, ulozNastaveni);
  svazPosuvnik('lupaVel', v => { S.lupaVel = v; }, ulozNastaveni);
  svazPosuvnik('pruhlednost', v => { S.pruhlednost = v; }, ulozNastaveni);
  svazPosuvnik('zesileni', v => { S.zesileni = v; }, ulozNastaveni);
  svazPosuvnik('prah', v => { S.prah = v; }, ulozNastaveni);
  svazPosuvnik('blikInterval', v => { S.blikInterval = v; nastavBlikani(); }, ulozNastaveni);
  let prestavTimer = null;
  const prestavPozdeji = () => { clearTimeout(prestavTimer); prestavTimer = setTimeout(() => { prestav(); ulozProjekt(); }, 60); };
  svazPosuvnik('dolDx', v => { S.dol.dx = v; prestavPozdeji(); });
  svazPosuvnik('dolDy', v => { S.dol.dy = v; prestavPozdeji(); });
  svazPosuvnik('dolS', v => { S.dol.s = v / 100; prestavPozdeji(); });
  svazPosuvnik('dolU', v => { S.dol.u = v; prestavPozdeji(); });
  $('lupaPul').addEventListener('change', () => { S.lupaPul = $('lupaPul').checked; ulozNastaveni(); kresli(); });
  $('popisky').addEventListener('change', () => { S.popisky = $('popisky').checked; ulozNastaveni(); kresli(); });
  for (const k of ['A', 'B']) $('popis' + k).addEventListener('input', () => { S['popis' + k] = $('popis' + k).value; kresli(); ulozProjekt(); });
  $('zpusob').addEventListener('change', () => { S.zpusob = $('zpusob').value; prestav(true); ulozProjekt(); });
  $('orez').addEventListener('change', () => { S.orez = $('orez').checked; prestav(true); ulozProjekt(); });
  $('model').addEventListener('change', () => { S.model = $('model').value; zmenaBodu(); });
  $('pouzitBody').addEventListener('change', () => { S.pouzitBody = $('pouzitBody').checked; zmenaBodu(); });
  $('smazBody').addEventListener('click', async () => { if (S.body.length && await Dialog.potvrd(t('Smazat všechny body?'))) { S.body = []; zmenaBodu(); } });
  $('pary').addEventListener('click', e => { const b = e.target.closest('[data-smaz-bod]'); if (b) { S.body.splice(+b.dataset.smazBod, 1); zmenaBodu(); } });
  $('blikPauza').addEventListener('click', () => { blikPauza = !blikPauza; nastavBlikani(); kresli(); });
  document.querySelectorAll('[data-smer]').forEach(b => b.addEventListener('click', () => { S.smer = b.dataset.smer; ulozNastaveni(); aktualizujPanel(); kresli(); }));
  document.querySelectorAll('[data-rozdil]').forEach(b => b.addEventListener('click', () => { S.rozdil = b.dataset.rozdil; ulozNastaveni(); aktualizujPanel(); kresli(); }));

  // ---------- nabídky a příkazy ----------
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));

  async function vlozZeSchranky() {
    try {
      for (const pol of await navigator.clipboard.read()) {
        const typ = pol.types.find(x => x.startsWith('image/'));
        if (typ) { await nastavObrazek(!OBR.A ? 'A' : 'B', await pol.getType(typ), t('ze schránky')); return; }
      }
      Dialog.info(t('Ve schránce není obrázek.'));
    } catch { Dialog.info(t('Prohlížeč nepovolil čtení schránky – použijte Ctrl+V.')); }
  }

  const PRIKAZY = {
    nactiA: () => $('souborA').click(), nactiB: () => $('souborB').click(), schranka: vlozZeSchranky,
    prohodit: () => {
      if (!OBR.A && !OBR.B) return;
      [OBR.A, OBR.B] = [OBR.B, OBR.A]; [S.popisA, S.popisB] = [S.popisB, S.popisA];
      S.body = S.body.map(p => ({ a: p.b, b: p.a })); S.dol = { dx: 0, dy: 0, s: 1, u: 0 };
      prestav(true); ulozProjekt();
    },
    ukazka, zavrit: async () => {
      if (!await Dialog.potvrd(t('Zavřít oba obrázky a smazat uloženou dvojici?'))) return;
      OBR.A = OBR.B = null; S.body = []; S.dol = { dx: 0, dy: 0, s: 1, u: 0 }; S.orez = false;
      if (S.rezim === 'body') S.rezim = 'posuvnik';
      prestav(); idb('del').catch(() => {});
    },
    rezimBody: () => nastavRezim('body'),
    autoPosun, orez: () => { S.orez = !S.orez; prestav(true); ulozProjekt(); },
    zrusZarovnani: async () => {
      if (!await Dialog.potvrd(t('Zrušit body i ruční doladění?'))) return;
      S.body = []; S.dol = { dx: 0, dy: 0, s: 1, u: 0 }; S.orez = false; prestav(true); ulozProjekt();
    },
    vejit: () => { vejitVse(); kresli(); },
    skutecna: () => {
      const c = c1, v = S.rezim === 'body' ? VA : V;
      zoom(v, 1 / v.s, c.clientWidth / 2, c.clientHeight / 2);
      if (S.rezim === 'body') zoom(VB, 1 / VB.s, c2.clientWidth / 2, c2.clientHeight / 2);
      kresli();
    },
    priblizit: () => { zoomStred(1.25); }, oddalit: () => { zoomStred(0.8); },
    exObrazek: () => otevriDialog('dlgObrazek'), exAnimace: () => otevriDialog('dlgAnimace'), exHtml: () => { otevriDialog('dlgHtml'); nahledHtml(); },
    napoveda: () => $('dlgNapoveda').showModal()
  };
  function zoomStred(f) {
    if (S.rezim === 'body') { zoom(VA, f, c1.clientWidth / 2, c1.clientHeight / 2); zoom(VB, f, c2.clientWidth / 2, c2.clientHeight / 2); }
    else zoom(V, f, c1.clientWidth / 2, c1.clientHeight / 2);
    kresli();
  }
  function otevriDialog(id) {
    if (!PA) { Dialog.info(t('Nejdřív načtěte oba obrázky.')); return; }
    $(id).showModal();
    if (id === 'dlgObrazek') infoObrazku();
  }

  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]');
    if (p && !p.disabled) { e.stopPropagation(); zavriNabidky(); PRIKAZY[p.dataset.prikaz](); return; }
    const r = e.target.closest('[data-rezim]');
    if (r) { zavriNabidky(); nastavRezim(r.dataset.rezim); return; }
    const sl = e.target.closest('[data-slot]');
    if (sl) { $('soubor' + sl.dataset.slot).click(); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  for (const k of ['A', 'B']) $('soubor' + k).addEventListener('change', e => { if (e.target.files.length) nactiSoubory(e.target.files, k); e.target.value = ''; });

  // přetažení souborů: na slot, na levou/pravou půlku plochy, nebo dva najednou
  plocha.addEventListener('dragover', e => {
    e.preventDefault();
    document.querySelectorAll('.slot').forEach(s => s.classList.toggle('nad', s.contains(e.target)));
  });
  plocha.addEventListener('dragleave', e => { if (!plocha.contains(e.relatedTarget)) document.querySelectorAll('.slot').forEach(s => s.classList.remove('nad')); });
  plocha.addEventListener('drop', e => {
    e.preventDefault();
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('nad'));
    const f = e.dataTransfer.files; if (!f.length) return;
    const sl = e.target.closest('[data-slot]');
    let slot = sl ? sl.dataset.slot : null;
    if (!slot && f.length === 1 && OBR.A && OBR.B) { const b = plocha.getBoundingClientRect(); slot = e.clientX < b.left + b.width / 2 ? 'A' : 'B'; }
    nactiSoubory(f, slot);
  });
  document.addEventListener('paste', e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const f = [...(e.clipboardData && e.clipboardData.files || [])].filter(x => x.type.startsWith('image/'));
    if (f.length) { e.preventDefault(); nactiSoubory(f.slice(0, 1), !OBR.A ? 'A' : 'B'); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if (e.target.closest('input, select, textarea, dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') { mezernik = true; if (S.rezim === 'blikani') { prepniBlik(); e.preventDefault(); } return; }
    const rezimy = { 1: 'posuvnik', 2: 'lupa', 3: 'vedle', 4: 'prolnuti', 5: 'rozdil', 6: 'blikani', b: 'body', B: 'body' };
    if (rezimy[e.key]) { nastavRezim(rezimy[e.key]); return; }
    if (e.key === 'f' || e.key === 'F') PRIKAZY.vejit();
    else if (e.key === '0') PRIKAZY.skutecna();
    else if (e.key === '+' || e.key === '=') zoomStred(1.25);
    else if (e.key === '-') zoomStred(0.8);
    else if ((e.key === 'x' || e.key === 'X') && PA) { prohozeno = !prohozeno; kresli(); }
    else if (S.rezim === 'posuvnik' && PA && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const k = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
      S.poloha = Math.max(0, Math.min(1, S.poloha + k)); e.preventDefault(); aktualizujPanel(); kresli(); ulozProjekt();
    }
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') mezernik = false; });
  addEventListener('resize', () => { zavriNabidky(); velikostPlatna(); vejitVse(); kresli(); });
  new ResizeObserver(() => { const w = c1.width; velikostPlatna(); if (w !== c1.width) { vejitVse(); kresli(); } }).observe(plocha);

  // ---------- automatický posun ----------
  async function autoPosun() {
    if (!PA) { Dialog.info(t('Nejdřív načtěte oba obrázky.')); return; }
    const k = Math.min(1, 512 / Math.max(PA.width, PA.height));
    const a = dataPlatna(zmensenina(PA, k)), b = dataPlatna(zmensenina(PB, k));
    const ma = new Uint8Array(a.width * a.height).fill(1), mb = new Uint8Array(a.width * a.height);
    for (let i = 0; i < mb.length; i++) mb[i] = b.data[i * 4 + 3] > 250 ? 1 : 0;
    const r = J.odhadPosunu(J.jas(a.data), J.jas(b.data), a.width, a.height, { ma, mb, rozsah: 12 });
    if (!r.dx && !r.dy) { Dialog.info(t('Obrázky už lícují – posun není potřeba.')); return; }
    S.dol.dx += r.dx / k; S.dol.dy += r.dy / k;
    prestav(); ulozProjekt();
    Dialog.info(t('Posun doladěn o') + ` ${(r.dx / k).toFixed(0)}, ${(r.dy / k).toFixed(0)} px.`);
  }

  // ---------- export: skládání snímků ----------
  /* Složený snímek v měřítku k: typ 'posuvnik' | 'vedle' | 'nadsebou' | 'rozdil'. */
  function snimek(typ, k, poloha, o) {
    o = o || {};
    const A = zdrojA(), B = zdrojB(), w = Math.round(A.width * k), h = Math.round(A.height * k);
    const c = document.createElement('canvas'), mezera = typ === 'vedle' || typ === 'nadsebou' ? Math.max(2, Math.round(w / 200)) : 0;
    c.width = typ === 'vedle' ? 2 * w + mezera : w; c.height = typ === 'nadsebou' ? 2 * h + mezera : h;
    if (o.sude) { c.width -= c.width % 2; c.height -= c.height % 2; }
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    const f = Math.max(12, Math.round(Math.min(w, h) / 22)), okraj = Math.round(f * 0.6);
    const pis = (text, x, y, vpravo) => {
      if (!text) return;
      g.save(); g.font = `600 ${f}px system-ui, sans-serif`; g.textBaseline = 'middle';
      const tw = g.measureText(text).width + f, th = f * 1.7, x0 = vpravo ? x - tw : x;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x0, y, tw, th); g.fillStyle = '#fff'; g.fillText(text, x0 + f / 2, y + th / 2); g.restore();
    };
    if (typ === 'posuvnik') {
      const svisle = S.smer === 'svisle';
      g.drawImage(A, 0, 0, w, h);
      g.save(); g.beginPath();
      if (svisle) g.rect(w * poloha, 0, w, h); else g.rect(0, h * poloha, w, h);
      g.clip(); g.drawImage(B, 0, 0, w, h); g.restore();
      const tl = Math.max(2, Math.round(Math.min(w, h) / 300));
      g.save(); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = tl * 2;
      if (svisle) g.fillRect(w * poloha - tl / 2, 0, tl, h); else g.fillRect(0, h * poloha - tl / 2, w, tl);
      g.restore();
      if (o.uchyt) { const d = dpr; dpr = tl / 2; uchyt(g, svisle ? w * poloha : w / 2, svisle ? h / 2 : h * poloha, Math.max(12, Math.min(w, h) / 22), svisle); dpr = d; }
      pis(popisek('A'), okraj, okraj);
      if (svisle) pis(popisek('B'), w - okraj, okraj, true); else pis(popisek('B'), okraj, h - okraj - f * 1.7);
    } else if (typ === 'vedle' || typ === 'nadsebou') {
      g.drawImage(A, 0, 0, w, h);
      const bx = typ === 'vedle' ? w + mezera : 0, by = typ === 'vedle' ? 0 : h + mezera;
      g.drawImage(B, bx, by, w, h);
      pis(popisek('A'), okraj, okraj); pis(popisek('B'), bx + okraj, by + okraj);
    } else {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.drawImage(obrazRozdilu(), 0, 0, w, h);
    }
    return c;
  }
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const pripona = typ => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[typ];
  function meritkoExportu(maxW, typ) {
    const sirka = (typ === 'vedle' ? 2 : 1) * PA.width;
    return +maxW ? Math.min(1, +maxW / sirka) : 1;
  }
  function infoObrazku() {
    const typ = $('exTyp').value, k = meritkoExportu($('exSirka').value, typ);
    const w = Math.round(PA.width * k), h = Math.round(PA.height * k);
    $('exObrInfo').textContent = t('Výsledek') + ': ' + (typ === 'vedle' ? 2 * w : w) + ' × ' + (typ === 'nadsebou' ? 2 * h : h) + ' px' +
      (typ === 'posuvnik' ? ' · ' + t('čára na') + ' ' + Math.round(S.poloha * 100) + ' %' : '');
    $('exUchyt').closest('label').hidden = typ !== 'posuvnik';
  }
  ['exTyp', 'exSirka'].forEach(id => $(id).addEventListener('change', infoObrazku));
  $('exObrUloz').addEventListener('click', () => {
    const typ = $('exTyp').value, fmt = $('exFormat').value;
    const c = snimek(typ, meritkoExportu($('exSirka').value, typ), S.poloha, { uchyt: $('exUchyt').checked });
    c.toBlob(b => {
      if (!b) { Dialog.chyba(t('Prohlížeč obrázek v tomto formátu neuložil.')); return; }
      stahni(b, J.nazevSouboru(S.popisA, S.popisB, pripona(fmt)));
    }, fmt, 0.92);
  });

  // ---------- export: animace ----------
  let zruseno = false;
  function nactiSkript(src, globalni) {
    if (window[globalni]) return Promise.resolve(window[globalni]);
    return new Promise((ok, chyba) => {
      const s = document.createElement('script'); s.src = src;
      s.onload = () => ok(window[globalni]); s.onerror = () => chyba(new Error(t('Knihovnu se nepodařilo načíst.')));
      document.head.appendChild(s);
    });
  }
  function kodujGifVeWorkeru(snimky, prubeh) {
    return new Promise((ok, chyba) => {
      let w;
      try { w = new Worker('animace_gif/worker.js'); } catch (e) { chyba(e); return; }
      w.onmessage = e => {
        if (e.data.prubeh != null) { prubeh(e.data.prubeh); return; }
        w.terminate();
        if (e.data.chyba) chyba(new Error(e.data.chyba)); else ok(e.data.hotovo);
      };
      w.onerror = e => { w.terminate(); chyba(new Error(e.message || 'worker')); };
      zastavWorker = () => { w.terminate(); chyba(new Error('zrušeno')); };
      w.postMessage({ id: 1, typ: 'gif', snimky, volby: { barev: 256, metoda: 'mediancut', dither: false, prehrani: 0, optimalizace: true } },
        snimky.map(s => s.obr.data.buffer));
    });
  }
  let zastavWorker = null;
  $('anZrusit').addEventListener('click', () => { zruseno = true; if (zastavWorker) zastavWorker(); });
  $('anStart').addEventListener('click', async () => {
    const fmt = $('anFormat').value, fps = +$('anFps').value, T = Math.max(1, Math.min(20, +$('anDelka').value || 4)), rozsah = +$('anRozsah').value;
    const k = Math.min(1, +$('anSirka').value / PA.width), N = Math.max(2, Math.round(T * fps));
    const pr = $('anPrubeh'), bar = pr.firstElementChild, info = $('anInfo');
    const ui = beh => { pr.hidden = !beh; $('anZrusit').hidden = !beh; $('anStart').disabled = beh; $('anZavrit').disabled = beh; };
    zruseno = false; ui(true); bar.style.width = '0';
    const jmeno = J.nazevSouboru(S.popisA, S.popisB, fmt);
    try {
      if (fmt === 'gif') {
        const snimky = [];
        for (let f = 0; f < N; f++) {
          if (zruseno) throw new Error('zrušeno');
          const c = snimek('posuvnik', k, J.polohaAnimace(f / fps, T, rozsah));
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
          snimky.push({ obr: { sirka: d.width, vyska: d.height, data: d.data }, delka: 1000 / fps });
          bar.style.width = (f / N * 40) + '%'; info.textContent = t('Snímek') + ' ' + (f + 1) + ' / ' + N;
          if (f % 5 === 4) await new Promise(r => setTimeout(r, 0));
        }
        info.textContent = t('Kóduji GIF…');
        const u8 = await kodujGifVeWorkeru(snimky, p => { bar.style.width = (40 + p * 60) + '%'; });
        stahni(new Blob([u8], { type: 'image/gif' }), jmeno);
        info.textContent = t('Hotovo') + ` – GIF ${(u8.length / 1048576).toFixed(1)} MB, ${N} ${t('snímků')}.`;
      } else {
        const MB = await nactiSkript('lib/mediabunny.min.js', 'Mediabunny');
        const c = snimek('posuvnik', k, 0.5, { sude: true }), mp4 = fmt === 'mp4';
        const kodek = await MB.getFirstEncodableVideoCodec(mp4 ? ['avc', 'hevc', 'vp9', 'av1'] : ['vp9', 'vp8', 'av1'], { width: c.width, height: c.height });
        if (!kodek) throw new Error(t('Prohlížeč neumí video v tomto formátu zakódovat – zkuste GIF nebo druhý formát.'));
        const platno = document.createElement('canvas'); platno.width = c.width; platno.height = c.height;
        const g = platno.getContext('2d');
        const vystup = new MB.Output({ format: mp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
        const zdroj = new MB.CanvasSource(platno, { codec: kodek, bitrate: MB.QUALITY_HIGH });
        vystup.addVideoTrack(zdroj, { frameRate: fps });
        await vystup.start();
        for (let f = 0; f < N; f++) {
          if (zruseno) { await vystup.cancel(); throw new Error('zrušeno'); }
          g.drawImage(snimek('posuvnik', k, J.polohaAnimace(f / fps, T, rozsah)), 0, 0, platno.width, platno.height);
          await zdroj.add(f / fps, 1 / fps);
          bar.style.width = ((f + 1) / N * 100) + '%'; info.textContent = t('Snímek') + ' ' + (f + 1) + ' / ' + N;
        }
        zdroj.close(); await vystup.finalize();
        const blob = new Blob([vystup.target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' });
        stahni(blob, jmeno);
        info.textContent = t('Hotovo') + ` – ${(blob.size / 1048576).toFixed(1)} MB, ${t('kodek')} ${kodek}.`;
      }
    } catch (e) {
      info.textContent = zruseno ? t('Export zrušen.') : t('Export selhal') + ': ' + e.message;
    } finally { ui(false); zastavWorker = null; }
  });

  // ---------- export: HTML posuvník ----------
  let htmlKod = null;
  function dataUrl(c, k, fmt, q) {
    const z = k < 1 ? zmensenina(c, k) : c;
    return z.toDataURL(fmt, q);
  }
  function sestavHtml() {
    const k = Math.min(1, +$('htSirka').value / PA.width), fmt = $('htFormat').value, q = +$('htKvalita').value;
    const A = zdrojA(), B = zdrojB();
    // B může mít mimo společnou plochu průhledné okraje → podložit černou (JPEG průhlednost neumí)
    const podloz = c => { const z = document.createElement('canvas'); z.width = c.width; z.height = c.height; const g = z.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, z.width, z.height); g.drawImage(c, 0, 0); return z; };
    const o = { id: 'pp-' + Math.random().toString(36).slice(2, 8), a: dataUrl(podloz(A), k, fmt, q), b: dataUrl(podloz(B), k, fmt, q),
      sirka: Math.round(A.width * k), vyska: Math.round(A.height * k), popisA: popisek('A'), popisB: popisek('B'), smer: $('htSmer').value, start: S.poloha };
    const fragment = J.htmlPosuvnik(o);
    return { fragment, dokument: J.htmlDokument(fragment, (popisek('A') || 'A') + ' / ' + (popisek('B') || 'B'), document.documentElement.lang || 'cs') };
  }
  let htmlTimer = null;
  function nahledHtml() {
    $('htSmer').value = S.smer;
    clearTimeout(htmlTimer);
    htmlTimer = setTimeout(() => {
      htmlKod = sestavHtml();
      ukazNahled();
      $('htInfo').textContent = t('Velikost kódu') + ': ' + (htmlKod.fragment.length / 1024 / 1024).toFixed(2) + ' MB' +
        (htmlKod.fragment.length > 3 * 1048576 ? ' – ' + t('pro web zvolte menší šířku nebo WebP') : '');
    }, 50);
  }
  ['htSirka', 'htFormat', 'htKvalita'].forEach(id => $(id).addEventListener('change', nahledHtml));
  $('htSmer').addEventListener('change', () => { clearTimeout(htmlTimer); htmlKod = sestavHtml(); ukazNahled(); });
  // náhled v izolovaném rámu (vytváří se až při otevření, zavřením dialogu zmizí i data obrázků)
  function ukazNahled() {
    let f = $('htNahled').querySelector('iframe');
    if (!f) { f = document.createElement('iframe'); f.className = 'nahled'; f.setAttribute('sandbox', 'allow-scripts'); f.title = t('Náhled posuvníku'); $('htNahled').appendChild(f); }
    f.srcdoc = htmlKod.dokument;
  }
  $('dlgHtml').addEventListener('close', () => { $('htNahled').innerHTML = ''; htmlKod = null; });
  $('htUloz').addEventListener('click', () => { if (htmlKod) stahni(new Blob([htmlKod.dokument], { type: 'text/html' }), J.nazevSouboru(S.popisA, S.popisB, 'html')); });
  $('htKopirovat').addEventListener('click', async () => {
    if (!htmlKod) return;
    try { await navigator.clipboard.writeText(htmlKod.fragment); Dialog.info(t('Kód je ve schránce – vložte ho do HTML své stránky.')); }
    catch { Dialog.chyba(t('Schránku se nepodařilo použít – stáhněte soubor .html a kód zkopírujte z něj.')); }
  });

  // ---------- ukázka ----------
  function kresliFasadu(g, w, h, po) {
    const nebe = g.createLinearGradient(0, 0, 0, h * 0.7);
    nebe.addColorStop(0, '#6f9fd0'); nebe.addColorStop(1, '#d4e4f2');
    g.fillStyle = nebe; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6f9b4f'; g.fillRect(0, h * 0.82, w, h * 0.18);
    // strom vlevo
    g.fillStyle = '#5b4030'; g.fillRect(w * 0.08, h * 0.5, w * 0.025, h * 0.34);
    g.fillStyle = '#4a7f3c';
    for (const [x, y, r] of [[0.095, 0.45, 0.09], [0.06, 0.52, 0.06], [0.135, 0.53, 0.065]]) { g.beginPath(); g.arc(w * x, h * y, w * r, 0, 7); g.fill(); }
    // dům
    const X = w * 0.3, Y = h * 0.34, W = w * 0.56, H = h * 0.5;
    g.fillStyle = po ? '#e8c27a' : '#a59a86'; g.fillRect(X, Y, W, H);
    g.fillStyle = po ? '#b5442c' : '#5d4e46';
    g.beginPath(); g.moveTo(X - w * 0.02, Y); g.lineTo(X + W / 2, Y - h * 0.2); g.lineTo(X + W + w * 0.02, Y); g.fill();
    if (!po) {   // opadaná omítka a praskliny
      g.fillStyle = '#857a6c';
      for (const [x, y, rx, ry] of [[0.12, 0.2, 0.08, 0.05], [0.7, 0.55, 0.1, 0.06], [0.4, 0.85, 0.12, 0.05], [0.85, 0.15, 0.06, 0.08]]) {
        g.beginPath(); g.ellipse(X + W * x, Y + H * y, W * rx, H * ry, 0.3, 0, 7); g.fill();
      }
      g.strokeStyle = '#4a4038'; g.lineWidth = Math.max(1, w / 500);
      g.beginPath(); g.moveTo(X + W * 0.55, Y); g.lineTo(X + W * 0.52, Y + H * 0.2); g.lineTo(X + W * 0.58, Y + H * 0.33); g.lineTo(X + W * 0.54, Y + H * 0.45); g.stroke();
      g.fillStyle = 'rgba(40,50,30,.35)'; g.fillRect(X, Y + H * 0.88, W, H * 0.12);
    }
    // okna a dveře
    const ow = W * 0.12, oh = H * 0.24;
    for (let r = 0; r < 2; r++) for (let s = 0; s < 4; s++) {
      if (r === 1 && s === 1) continue;
      const x = X + W * (0.08 + s * 0.24), y = Y + H * (0.12 + r * 0.42);
      g.fillStyle = po ? '#fafafa' : '#6b6259'; g.fillRect(x - ow * 0.08, y - oh * 0.06, ow * 1.16, oh * 1.12);
      g.fillStyle = po ? '#7fb3d9' : (r === 0 && s === 2 ? '#1c1c1c' : '#3d4a52'); g.fillRect(x, y, ow, oh);
      g.strokeStyle = po ? '#fafafa' : '#6b6259'; g.lineWidth = ow * 0.06;
      g.beginPath(); g.moveTo(x + ow / 2, y); g.lineTo(x + ow / 2, y + oh); g.moveTo(x, y + oh * 0.4); g.lineTo(x + ow, y + oh * 0.4); g.stroke();
      if (!po && r === 0 && s === 2) { g.strokeStyle = '#999'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ow * 0.7, y + oh * 0.6); g.lineTo(x + ow * 0.2, y + oh); g.stroke(); }
      if (po) { g.fillStyle = '#c0392b'; g.fillRect(x - ow * 0.05, y + oh * 1.06, ow * 1.1, oh * 0.12); g.fillStyle = '#e84393'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + ow * (0.12 + i * 0.25), y + oh * 1.05, ow * 0.07, 0, 7); g.fill(); } }
    }
    g.fillStyle = po ? '#6d3b1f' : '#3e3530'; g.fillRect(X + W * 0.32, Y + H * 0.55, W * 0.12, H * 0.45);
    g.fillStyle = po ? '#d4a017' : '#555'; g.beginPath(); g.arc(X + W * 0.42, Y + H * 0.78, W * 0.008, 0, 7); g.fill();
    // číslo domu – jen po
    if (po) { g.fillStyle = '#2c3e50'; g.fillRect(X + W * 0.47, Y + H * 0.6, W * 0.05, H * 0.07); g.fillStyle = '#fff'; g.font = `700 ${Math.round(H * 0.05)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('12', X + W * 0.495, Y + H * 0.635); g.textAlign = 'start'; }
    return [[X, Y], [X + W, Y], [X + W, Y + H], [X, Y + H]];   // rohy fasády
  }
  async function ukazka() {
    if ((OBR.A || OBR.B) && !await Dialog.potvrd(t('Nahradit načtené obrázky ukázkou?'))) return;
    const w = 1200, h = 800;
    const a = document.createElement('canvas'); a.width = w; a.height = h;
    const rohy = kresliFasadu(a.getContext('2d'), w, h, false);
    // „po“ foceno z jiného místa: menší rozlišení, mírně otočené a posunuté
    const b = document.createElement('canvas'); b.width = 1000; b.height = 700;
    const g = b.getContext('2d'), T = J.doladeni(0, 0, -30, 10, 0.86, 2.5);
    g.fillStyle = '#9ab'; g.fillRect(0, 0, b.width, b.height);
    g.setTransform(...T); kresliFasadu(g, w, h, true);
    const blob = c => new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
    await nastavObrazek('A', await blob(a), t('ukázka – před'), true);
    await nastavObrazek('B', await blob(b), t('ukázka – po'), true);
    S.popisA = t('Před opravou'); S.popisB = t('Po opravě');
    S.body = rohy.map(([x, y]) => ({ a: { x, y }, b: J.pouzij(T, x, y) }));
    S.model = 'auto'; S.pouzitBody = true; S.dol = { dx: 0, dy: 0, s: 1, u: 0 }; S.orez = true; S.poloha = 0.5;
    prestav(true); ulozProjekt();
    Dialog.info(t('Ukázka: B je natočené a posunuté, zarovnalo se podle 4 párů bodů (📍 Body).'));
  }

  // ---------- start ----------
  aktualizujPanel();
  velikostPlatna();
  idb('get').then(async p => {
    if (!p || (!p.a && !p.b)) { prestav(); return; }
    if (p.a) await nastavObrazek('A', p.a, p.nazevA, true);
    if (p.b) await nastavObrazek('B', p.b, p.nazevB, true);
    for (const k of ['body', 'dol', 'zpusob', 'model', 'pouzitBody', 'orez', 'popisA', 'popisB', 'poloha']) if (p[k] != null) S[k] = p[k];
    prestav(true);
  }).catch(() => prestav());
  nastavBlikani();

  window.PredPoApp = { S, OBR, prestav, kresli, snimek, ukazka, nastavRezim, analyza: () => PA && analyza(), sestavHtml, autoPosun };
})();
