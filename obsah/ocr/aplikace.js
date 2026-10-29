/* ============================================================
   ocr/aplikace.js – ovládání stránky OCR (obsah/ocr.html).
   Logika obrazu a textu je v ocr/jadro.js (window.OCR).
   Tesseract, PDF.js i pdf-lib se načítají až při použití.
   ============================================================ */
(function () {
  'use strict';
  const O = window.OCR;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_ocr_nastaveni';
  const TESS = 'lib/tesseract/';
  const abs = c => new URL(c, location.href).href;
  const NAHLED_MAX = 1400;   // delší strana náhledu v px

  // ---------- stav ----------
  const stav = {
    strany: [],          // { id, nazev, zdroj, dpi, geom:{otoceni90,uhel,orez}, oblasti:[], vysledek, text, palec }
    aktivni: -1,
    rezim: 'slova',
    zpracovany: true,
    plnaVelikost: false,
    vybraneSlovo: -1,
    bezi: false,
    nast: { filtry: Object.assign({}, O.VYCHOZI, { seda: true, autoKontrast: true }), jazyk: 'ces', prahJistoty: 70, vsechnaSlova: false, pdfDpi: 300, pdfObraz: 'puvodni', obrDpi: 300 },
  };
  try {
    const u = JSON.parse(localStorage.getItem(KLIC) || 'null');
    if (u) { Object.assign(stav.nast, u, { filtry: Object.assign({}, stav.nast.filtry, u.filtry || {}) }); }
  } catch (_) { /* poškozené nastavení – výchozí */ }
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(stav.nast)); } catch (_) { /* plné úložiště */ } };
  let dalsiId = 1;
  const aktivni = () => stav.strany[stav.aktivni] || null;
  const podpisGeom = g => JSON.stringify([g.otoceni90 || 0, g.uhel || 0, g.orez || null]);

  // ---------- pomocné obrazové funkce ----------
  function naPlatno(img) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    return c;
  }
  function zPlatna(c) { return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); }
  const odlehci = () => new Promise(r => setTimeout(r, 0));

  // ---------- PDF.js ----------
  let pdfjs = null;
  async function nactiPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import(abs('lib/pdfjs/pdf.min.mjs'));
    pdfjs.GlobalWorkerOptions.workerSrc = abs('lib/pdfjs/pdf.worker.min.mjs');
    return pdfjs;
  }
  async function vykresliPdf(dok, cislo, dpi) {
    const str = await dok.getPage(cislo), vp = str.getViewport({ scale: dpi / 72 });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await str.render({ canvasContext: x, viewport: vp }).promise;
    str.cleanup();
    return c;
  }

  // ---------- rastry stránek (plné rozlišení a náhled, malá mezipaměť) ----------
  const mezipamet = new Map();   // klíč → ImageData
  function zapamatuj(klic, d) {
    mezipamet.delete(klic); mezipamet.set(klic, d);
    while (mezipamet.size > 4) mezipamet.delete(mezipamet.keys().next().value);
    return d;
  }
  async function platnoZdroje(s) {
    if (s.zdroj.typ === 'pdf') return vykresliPdf(s.zdroj.dok, s.zdroj.cislo, s.dpi);
    const bmp = await createImageBitmap(s.zdroj.blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0);
    if (bmp.close) bmp.close();
    return c;
  }
  async function rastr(s) {
    const k = s.id + ':plny';
    if (mezipamet.has(k)) return zapamatuj(k, mezipamet.get(k));
    return zapamatuj(k, zPlatna(await platnoZdroje(s)));
  }
  async function nahledRastr(s) {
    const k = s.id + ':nahled';
    if (mezipamet.has(k)) return zapamatuj(k, mezipamet.get(k));
    const c = await platnoZdroje(s), m = Math.min(1, NAHLED_MAX / Math.max(c.width, c.height));
    s.plnaSirka = c.width; s.plnaVyska = c.height;
    if (m >= 1) return zapamatuj(k, zPlatna(c));
    const n = document.createElement('canvas'); n.width = Math.round(c.width * m); n.height = Math.round(c.height * m);
    const x = n.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, n.width, n.height);
    return zapamatuj(k, zPlatna(n));
  }
  async function palec(s) {
    const d = await nahledRastr(s), c = naPlatno(d), m = 140 / Math.max(c.width, c.height);
    const p = document.createElement('canvas'); p.width = Math.max(1, Math.round(c.width * m)); p.height = Math.max(1, Math.round(c.height * m));
    p.getContext('2d').drawImage(c, 0, 0, p.width, p.height);
    return p.toDataURL('image/jpeg', 0.7);
  }

  // ---------- přidání souborů ----------
  async function pridejSoubory(soubory) {
    const seznam = Array.from(soubory || []).filter(Boolean);
    if (!seznam.length) return;
    const pred = stav.strany.length;
    for (const f of seznam) {
      const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
      try {
        if (pdf) await pridejPdf(f);
        else if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|tiff?|avif)$/i.test(f.name || '')) {
          const s = novaStrana(f.name || 'obrázek.png', { typ: 'obrazek', blob: f }, stav.nast.obrDpi);
          await nahledRastr(s);   // ověří, že jde obrázek dekódovat
          stav.strany.push(s);
        } else Dialog.chyba('Soubor „' + f.name + '“ není obrázek ani PDF.');
      } catch (e) {
        console.warn(e);
        Dialog.chyba('Soubor „' + (f.name || '') + '“ se nepodařilo načíst' + (/tiff?$/i.test(f.name || '') ? ' (TIFF prohlížeč neumí – převeďte na PNG).' : '.'));
      }
    }
    if (stav.strany.length > pred) {
      vykresliStrany();
      await vyberStranu(pred);
      for (const s of stav.strany.slice(pred)) if (!s.palec) { s.palec = await palec(s); vykresliStrany(); }
    }
  }
  function novaStrana(nazev, zdroj, dpi) {
    return { id: dalsiId++, nazev, zdroj, dpi, geom: { otoceni90: 0, uhel: 0, orez: null }, oblasti: [], vysledek: null, text: '', palec: null };
  }
  async function pridejPdf(f) {
    const lib = await nactiPdfjs();
    const dok = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), cMapUrl: 'lib/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: 'lib/pdfjs/standard_fonts/' }).promise;
    let cisla = Array.from({ length: dok.numPages }, (_, i) => i + 1);
    if (dok.numPages > 1) {
      for (;;) {
        const r = await Dialog.zeptej(`PDF „${f.name}“ má ${dok.numPages} stran. Které načíst? (např. 1-3, 5, 8-; prázdné = vše)`, '');
        if (r === null) return;
        try { cisla = O.parsujRozsah(r, dok.numPages); break; } catch (e) { Dialog.chyba(e.message); }
      }
    }
    for (const c of cisla) stav.strany.push(novaStrana(`${f.name} – str. ${c}`, { typ: 'pdf', dok, cislo: c }, stav.nast.pdfDpi));
  }

  // ---------- ukázkový sken (vygenerovaný, s náklonem, stínem a šumem) ----------
  async function ukazka() {
    const w = 1500, h = 1050, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h);
    x.save(); x.translate(w / 2, h / 2); x.rotate(2.2 * Math.PI / 180); x.translate(-w / 2, -h / 2);
    x.fillStyle = '#1d1d1d';
    x.font = 'bold 46px "Liberation Serif", Georgia, serif'; x.fillText('Příliš žluťoučký kůň', 110, 140);
    x.font = '30px "Liberation Serif", Georgia, serif';
    const radky = [
      'Tato stránka převádí text z fotek, skenů a PDF na upravitelný',
      'text. Rozpoznávání běží přímo v prohlížeči, soubory se nikam',
      'neodesílají. Před čtením můžete obraz narovnat, oříznout,',
      'převést na šedou a upravit kontrast nebo práh.',
      '',
      'Výsledek uložíte jako prostý text nebo jako prohledávatelné PDF,',
      've kterém leží neviditelná textová vrstva přesně na slovech.',
      'Úpěl ďábelské ódy – ěščřžýáíéúů ĚŠČŘŽÝÁÍÉÚŮ 0123456789.',
    ];
    radky.forEach((t, i) => x.fillText(t, 110, 230 + i * 52));
    x.font = 'italic 26px "Liberation Serif", Georgia, serif';
    x.fillText('V Praze dne 29. října 2026', 110, 720);
    x.strokeStyle = '#1d1d1d'; x.lineWidth = 2; x.strokeRect(820, 650, 520, 160);
    x.font = '24px "Liberation Sans", Arial, sans-serif'; x.fillText('Razítko a podpis', 850, 700);
    x.restore();
    // stín zprava (nerovnoměrné osvětlení fotky)
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,30,10,0.35)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const d = x.getImageData(0, 0, w, h);
    let sem = 7;
    for (let i = 0; i < d.data.length; i += 4) { sem = (sem * 1103515245 + 12345) & 0x7fffffff; const n = (sem % 41) - 20; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    x.putImageData(d, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await pridejSoubory([new File([blob], 'ukázkový sken.png', { type: 'image/png' })]);
  }

  // ---------- seznam stránek ----------
  function vykresliStrany() {
    const el = $('strany');
    if (!stav.strany.length) { el.innerHTML = '<div class="strany-prazdne">Žádné stránky</div>'; return; }
    el.innerHTML = '';
    stav.strany.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'strana' + (i === stav.aktivni ? ' aktivni' : '');
      d.title = s.nazev;
      d.tabIndex = 0;
      let st = '';
      if (s.vysledek) {
        const t = O.statistika(s.vysledek.slova, stav.nast.prahJistoty);
        st = `<span class="stav ${t.prumer >= 80 ? 'ok' : 'slabe'}" title="Přečteno, průměrná jistota ${t.prumer} %">✓ ${t.prumer}</span>`;
      }
      d.innerHTML = `<div class="nahl">${s.palec ? `<img alt="" src="${s.palec}" style="transform:rotate(${(s.geom.otoceni90 || 0) * 90}deg)">` : '…'}</div>${st}<span class="jm">${i + 1}. ${esc(s.nazev)}</span>`;
      d.addEventListener('click', () => vyberStranu(i));
      d.addEventListener('keydown', e => { if (e.key === 'Enter') vyberStranu(i); });
      el.appendChild(d);
    });
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function vyberStranu(i) {
    if (!stav.strany.length) { stav.aktivni = -1; return obnovVse(); }
    stav.aktivni = Math.max(0, Math.min(stav.strany.length - 1, i));
    stav.vybraneSlovo = -1;
    vykresliStrany();
    const a = $('strany').children[stav.aktivni]; if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    obnovPanel();
    await prekresli();
  }
  function obnovVse() { vykresliStrany(); obnovPanel(); prekresli(); }

  // ---------- náhled ----------
  let posledniNahled = null;   // { sirka, vyska } zobrazeného obrazu
  let planovano = null;
  function prekresli() {
    if (planovano) return planovano;
    planovano = new Promise(r => setTimeout(r, 30)).then(async () => {
      planovano = null;
      await prekresliHned();
    });
    return planovano;
  }
  async function prekresliHned() {
    const s = aktivni();
    $('prazdno').hidden = !!s; $('okno').hidden = !s;
    if (!s) { $('infoRadek').textContent = ''; return; }
    const nr = await nahledRastr(s);
    if (s !== aktivni()) return;
    const orezRezim = stav.rezim === 'orez';
    let img = O.geometrie(nr, s.geom, orezRezim);
    if (stav.zpracovany && !orezRezim) img = O.filtry(img, stav.nast.filtry, true).obraz;
    const c = $('platno');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    posledniNahled = { sirka: img.width, vyska: img.height };
    $('okno').classList.toggle('plna', stav.plnaVelikost);
    vykresliVrstvu();
    const g = s.geom;
    $('infoRadek').textContent = `Stránka ${stav.aktivni + 1}/${stav.strany.length} · ${s.plnaSirka || '?'}×${s.plnaVyska || '?'} px · ${s.dpi} DPI` +
      (g.otoceni90 ? ` · otočeno ${g.otoceni90 * 90}°` : '') + (g.uhel ? ` · natočení ${g.uhel}°` : '') + (g.orez ? ' · oříznuto' : '') +
      (orezRezim ? ' · táhněte myší pro nový ořez' : stav.rezim === 'oblast' ? ' · táhněte myší pro novou oblast' : '');
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, at) { const e = document.createElementNS(SVGNS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; }
  function vykresliVrstvu() {
    const svg = $('vrstva'), s = aktivni();
    svg.innerHTML = '';
    if (!s || !posledniNahled) return;
    const W = posledniNahled.sirka, H = posledniNahled.vyska;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    if (stav.rezim === 'orez') {
      const r = s.geom.orez;
      if (r) {
        const x = r.x * W, y = r.y * H, w = r.w * W, h = r.h * H;
        svg.appendChild(svgEl('path', { class: 'orez-maska', d: `M0 0H${W}V${H}H0Z M${x} ${y}V${y + h}H${x + w}V${y}Z` }));
        svg.appendChild(svgEl('rect', { class: 'orez-ram', x, y, width: w, height: h }));
      }
      return;
    }
    // slova z výsledku (jen pokud sedí natočení a ořez)
    const v = s.vysledek;
    if (v && v.podpis === podpisGeom(s.geom)) {
      const kx = W / v.sirka, ky = H / v.vyska, prah = stav.nast.prahJistoty;
      v.slova.forEach((w, i) => {
        const nizka = w.conf < prah;   // ostatní slova jsou průhledný cíl pro klik
        const r = svgEl('rect', {
          class: 'sl' + (nizka ? ' nizka' : '') + (stav.nast.vsechnaSlova ? ' vse' : '') + (i === stav.vybraneSlovo ? ' vybrane' : ''),
          x: w.bbox.x0 * kx, y: w.bbox.y0 * ky, width: Math.max(1, (w.bbox.x1 - w.bbox.x0) * kx), height: Math.max(1, (w.bbox.y1 - w.bbox.y0) * ky), 'data-i': i,
        });
        const t = svgEl('title', {}); t.textContent = `${w.text} – jistota ${w.conf} %`; r.appendChild(t);
        svg.appendChild(r);
      });
    }
    // oblasti
    const fs = Math.max(14, Math.round(Math.max(W, H) / 45));
    s.oblasti.forEach((o, i) => {
      const r = svgEl('rect', { class: 'obl', x: o.x * W, y: o.y * H, width: o.w * W, height: o.h * H, 'data-obl': i });
      const t = svgEl('title', {}); t.textContent = `Oblast ${i + 1} (dvojklik = smazat)`; r.appendChild(t);
      svg.appendChild(r);
      const c = svgEl('text', { class: 'obl-cislo', x: o.x * W + 5, y: o.y * H + fs, 'font-size': fs });
      c.textContent = i + 1; svg.appendChild(c);
    });
  }

  // ---------- myš na náhledu ----------
  let tah = null;
  function bodNorm(e) {
    const r = $('vrstva').getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }
  $('vrstva').addEventListener('pointerdown', e => {
    const s = aktivni(); if (!s || e.button !== 0) return;
    if (stav.rezim === 'slova') {
      const i = e.target.getAttribute && e.target.getAttribute('data-i');
      if (i != null) skocNaSlovo(+i);
      return;
    }
    e.preventDefault();
    $('vrstva').setPointerCapture(e.pointerId);
    const b = bodNorm(e);
    tah = { x0: b.x, y0: b.y, el: svgEl('rect', { class: 'kresleni', x: 0, y: 0, width: 0, height: 0 }) };
    $('vrstva').appendChild(tah.el);
  });
  $('vrstva').addEventListener('pointermove', e => {
    if (!tah || !posledniNahled) return;
    const b = bodNorm(e), r = O.obdelnik(tah.x0, tah.y0, b.x, b.y), W = posledniNahled.sirka, H = posledniNahled.vyska;
    tah.el.setAttribute('x', r.x * W); tah.el.setAttribute('y', r.y * H); tah.el.setAttribute('width', r.w * W); tah.el.setAttribute('height', r.h * H);
  });
  $('vrstva').addEventListener('pointerup', async e => {
    if (!tah) return;
    const b = bodNorm(e), r = O.obdelnik(tah.x0, tah.y0, b.x, b.y), s = aktivni();
    tah = null;
    if (!s || r.w < 0.01 || r.h < 0.01) return vykresliVrstvu();
    if (stav.rezim === 'oblast') {
      s.oblasti.push(r);
      obnovOblasti(); vykresliVrstvu();
    } else if (stav.rezim === 'orez') {
      // ořez se zadává v souřadnicích obrazu bez ořezu
      s.geom.orez = r;
      if (s.oblasti.length) { s.oblasti = []; Dialog.info('Oblasti byly po ořezu smazány.'); }
      nastavRezim('slova');
      obnovPanel();
    }
  });
  $('vrstva').addEventListener('dblclick', e => {
    const i = e.target.getAttribute && e.target.getAttribute('data-obl');
    const s = aktivni();
    if (i != null && s) { s.oblasti.splice(+i, 1); obnovOblasti(); vykresliVrstvu(); }
  });

  function nastavRezim(r) {
    stav.rezim = r;
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
    $('okno').classList.toggle('rezim-oblast', r === 'oblast');
    $('okno').classList.toggle('rezim-orez', r === 'orez');
    prekresli();
  }

  // ---------- text a skok na slovo ----------
  function skocNaSlovo(i) {
    const s = aktivni(); if (!s || !s.vysledek) return;
    const w = s.vysledek.slova[i]; if (!w) return;
    stav.vybraneSlovo = i;
    vykresliVrstvu();
    prepniZalozku('text');
    const ta = $('text');
    const pos = s.upraveno ? O.najdiVTextu(ta.value, w.text, w.od) : w.od;
    if (pos < 0) { Dialog.info('Slovo „' + w.text + '“ už v upraveném textu není.'); return; }
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos + w.text.length);
    // posun textového pole na řádek se slovem (zrcadlo se stejným zalomením)
    const z = $('zrcadlo');
    z.style.width = ta.clientWidth + 'px';
    z.textContent = ta.value.slice(0, pos);
    ta.scrollTop = Math.max(0, z.scrollHeight - ta.clientHeight / 3);
    if (window.matchMedia('(max-width:900px)').matches) ta.scrollIntoView({ block: 'center' });
  }
  $('text').addEventListener('input', () => {
    const s = aktivni(); if (!s) return;
    s.text = $('text').value; s.upraveno = !!s.vysledek && s.text !== s.vysledek.text;
  });
  // kurzor v textu → zvýraznit slovo na náhledu (jen u neupraveného textu, kde sedí pozice)
  $('text').addEventListener('click', () => {
    const s = aktivni(); if (!s || !s.vysledek || s.upraveno) return;
    const p = $('text').selectionStart, i = s.vysledek.slova.findIndex(w => p >= w.od && p <= w.do);
    if (i >= 0 && i !== stav.vybraneSlovo) { stav.vybraneSlovo = i; vykresliVrstvu(); }
  });

  // ---------- panel ----------
  function prepniZalozku(z) {
    $('zalObraz').setAttribute('aria-selected', String(z === 'obraz'));
    $('zalText').setAttribute('aria-selected', String(z === 'text'));
    $('panelObraz').hidden = z !== 'obraz'; $('panelText').hidden = z !== 'text';
  }
  document.querySelectorAll('[data-zal]').forEach(b => b.addEventListener('click', () => prepniZalozku(b.dataset.zal)));

  function obnovOblasti() {
    const s = aktivni(), ol = $('oblasti');
    ol.innerHTML = '';
    if (!s) return;
    s.oblasti.forEach((o, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<b>${i + 1}</b><span>${Math.round(o.x * 100)} %, ${Math.round(o.y * 100)} % · ${Math.round(o.w * 100)}×${Math.round(o.h * 100)} %</span>` +
        `<button class="tl" data-o="nahoru" title="Číst dřív" aria-label="Číst dřív" ${i ? '' : 'disabled'}>↑</button>` +
        `<button class="tl" data-o="dolu" title="Číst později" aria-label="Číst později" ${i < s.oblasti.length - 1 ? '' : 'disabled'}>↓</button>` +
        `<button class="tl" data-o="smaz" title="Smazat oblast" aria-label="Smazat oblast">✕</button>`;
      li.addEventListener('click', e => {
        const b = e.target.closest('[data-o]'); if (!b) return;
        if (b.dataset.o === 'smaz') s.oblasti.splice(i, 1);
        else { const j = b.dataset.o === 'nahoru' ? i - 1 : i + 1; [s.oblasti[i], s.oblasti[j]] = [s.oblasti[j], s.oblasti[i]]; }
        obnovOblasti(); vykresliVrstvu();
      });
      ol.appendChild(li);
    });
  }

  function obnovPanel() {
    const s = aktivni(), f = stav.nast.filtry;
    $('uhel').value = s ? s.geom.uhel || 0 : 0;
    $('uhelV').textContent = (s ? s.geom.uhel || 0 : 0).toLocaleString('cs') + '°';
    $('tlZrusOrez').disabled = !(s && s.geom.orez);
    $('zvetseni').value = String(f.zvetseni);
    $('seda').checked = f.seda; $('autoKontrast').checked = f.autoKontrast; $('invertovat').checked = f.invertovat;
    $('kontrast').value = f.kontrast; $('kontrastV').textContent = f.kontrast;
    $('jas').value = f.jas; $('jasV').textContent = f.jas;
    $('odsum').value = String(f.odsum); $('prah').value = f.prah;
    $('okno').value = f.okno; $('oknoV').textContent = String(f.okno).replace('.', ',') + ' %';
    $('citlivost').value = f.citlivost; $('citlivostV').textContent = Number(f.citlivost).toFixed(2).replace('.', ',');
    $('adaptivniVolby').hidden = f.prah !== 'adaptivni';
    $('jazyk').value = stav.nast.jazyk; $('prahJistoty').value = stav.nast.prahJistoty; $('vsechnaSlova').checked = stav.nast.vsechnaSlova;
    $('pdfDpi').value = String(stav.nast.pdfDpi); $('pdfObraz').value = stav.nast.pdfObraz; $('obrDpi').value = stav.nast.obrDpi;
    $('text').value = s ? s.text || '' : '';
    $('text').disabled = !s;
    obnovStat(); obnovOblasti();
  }
  function obnovStat() {
    const s = aktivni(), el = $('stat');
    if (!s || !s.vysledek) { el.textContent = s ? 'Stránka zatím není přečtená – stiskněte ▶ Přečíst.' : 'Žádná stránka.'; return; }
    const t = O.statistika(s.vysledek.slova, stav.nast.prahJistoty);
    const jinaGeom = s.vysledek.podpis !== podpisGeom(s.geom);
    el.innerHTML = `<b>${t.pocet}</b> slov · průměrná jistota <b>${t.prumer} %</b> · <span class="slabe">${t.nizkych} nejistých</span> · ${esc(s.vysledek.jazyk)}` +
      (jinaGeom ? '<br><span class="slabe">Natočení nebo ořez se od čtení změnily – přečtěte stránku znovu.</span>' : '');
  }

  // vstupy úprav obrazu
  const filtr = (id, kl, prevod) => $(id).addEventListener('input', () => {
    stav.nast.filtry[kl] = prevod($(id));
    uloz(); obnovPanel(); prekresli();
  });
  filtr('zvetseni', 'zvetseni', e => (e.value === 'auto' ? 'auto' : Number(e.value)));
  filtr('seda', 'seda', e => e.checked); filtr('autoKontrast', 'autoKontrast', e => e.checked); filtr('invertovat', 'invertovat', e => e.checked);
  filtr('kontrast', 'kontrast', e => Number(e.value)); filtr('jas', 'jas', e => Number(e.value));
  filtr('odsum', 'odsum', e => Number(e.value)); filtr('prah', 'prah', e => e.value);
  filtr('okno', 'okno', e => Number(e.value)); filtr('citlivost', 'citlivost', e => Number(e.value));
  $('uhel').addEventListener('input', () => {
    const s = aktivni(); if (!s) return;
    s.geom.uhel = Number($('uhel').value); $('uhelV').textContent = s.geom.uhel.toLocaleString('cs') + '°';
    obnovStat(); prekresli();
  });
  $('jazyk').addEventListener('change', () => { stav.nast.jazyk = $('jazyk').value; uloz(); });
  $('prahJistoty').addEventListener('input', () => { stav.nast.prahJistoty = Math.max(0, Math.min(100, Number($('prahJistoty').value) || 0)); uloz(); obnovStat(); vykresliVrstvu(); vykresliStrany(); });
  $('vsechnaSlova').addEventListener('change', () => { stav.nast.vsechnaSlova = $('vsechnaSlova').checked; uloz(); vykresliVrstvu(); });
  $('pdfDpi').addEventListener('change', () => { stav.nast.pdfDpi = Number($('pdfDpi').value); uloz(); });
  $('pdfObraz').addEventListener('change', () => { stav.nast.pdfObraz = $('pdfObraz').value; uloz(); });
  $('obrDpi').addEventListener('change', () => {
    stav.nast.obrDpi = Math.max(50, Math.min(1200, Number($('obrDpi').value) || 300)); uloz();
    stav.strany.forEach(s => { if (s.zdroj.typ === 'obrazek') s.dpi = stav.nast.obrDpi; });
    prekresli();
  });

  // ---------- Tesseract ----------
  let worker = null, workerJazyk = '', naPrubeh = null, zrusit = null;
  function nactiTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise((ok, chyba) => {
      const s = document.createElement('script');
      s.src = TESS + 'tesseract.min.js';
      s.onload = () => (window.Tesseract ? ok(window.Tesseract) : chyba(new Error('Tesseract se nepodařilo načíst.')));
      s.onerror = () => { s.remove(); chyba(new Error('Tesseract se nepodařilo stáhnout (jste offline?).')); };
      document.head.appendChild(s);
    });
  }
  async function dejWorker(jazyk) {
    if (worker && workerJazyk === jazyk) return worker;
    if (worker) { try { await worker.terminate(); } catch (_) { /* nic */ } worker = null; }
    const T = await nactiTesseract();
    worker = await T.createWorker(jazyk.split('+'), 1, {
      workerPath: abs(TESS + 'worker.min.js'), corePath: abs(TESS), langPath: abs(TESS), gzip: false,
      logger: m => { if (naPrubeh && m && typeof m.progress === 'number') naPrubeh(m.progress, m.status || ''); },
    });
    workerJazyk = jazyk;
    return worker;
  }
  // čeká na slib, ale skončí hned při zrušení
  function sHlidanim(slib) {
    return Promise.race([slib, new Promise((_, ne) => { zrusit = () => ne(new Error('zrušeno')); })]);
  }
  const STAVY = { 'loading tesseract core': 'načítám Tesseract', 'initializing tesseract': 'spouštím Tesseract', 'loading language traineddata': 'načítám jazykový model', 'initializing api': 'připravuji', 'recognizing text': 'rozpoznávám text' };

  function ukazPrubeh(text, podil) {
    $('prubeh').hidden = false;
    $('prubehText').textContent = text;
    $('prubehPruh').style.width = Math.round(Math.max(0, Math.min(1, podil)) * 100) + '%';
  }

  // přečte jednu stránku; vola(podíl, popis) hlásí průběh
  async function prectiStranu(s, vola) {
    vola(0, 'připravuji obraz');
    await odlehci();
    const plny = await rastr(s);
    await odlehci();
    const geom = O.geometrie(plny, s.geom);
    const { obraz, zvetseni } = O.filtry(geom, stav.nast.filtry);
    const c = naPlatno(obraz);
    await odlehci();
    vola(0.05, 'spouštím Tesseract');
    const w = await sHlidanim(dejWorker(stav.nast.jazyk));
    const oblasti = s.oblasti.length ? s.oblasti : [null];
    const casti = [];
    for (let k = 0; k < oblasti.length; k++) {
      naPrubeh = (p, st) => vola(0.05 + 0.95 * (k + (st === 'recognizing text' ? p : 0)) / oblasti.length, (STAVY[st] || st) + (oblasti.length > 1 ? ` (oblast ${k + 1}/${oblasti.length})` : ''));
      await sHlidanim(w.setParameters({ tessedit_pageseg_mode: oblasti[k] ? '6' : '3', preserve_interword_spaces: '1' }));
      const opt = oblasti[k] ? { rectangle: O.oblastPx(oblasti[k], c.width, c.height) } : {};
      const r = await sHlidanim(w.recognize(c, opt, { text: true, blocks: true }));
      casti.push(O.slozText(odstavceZ(r.data)));
    }
    naPrubeh = null;
    const v = O.spojVysledky(casti);
    s.vysledek = { text: v.text, slova: v.slova, sirka: c.width, vyska: c.height, zvetseni, podpis: podpisGeom(s.geom), jazyk: stav.nast.jazyk, dpi: s.dpi };
    s.text = v.text; s.upraveno = false;
  }
  function odstavceZ(data) {
    if (data.blocks) return data.blocks.flatMap(b => b.paragraphs || []);
    return data.paragraphs || [];
  }

  async function ctiStrany(indexy) {
    if (stav.bezi) return Dialog.info('Čtení už běží.');
    if (!indexy.length) return;
    stav.bezi = true;
    let hotovo = 0, chyba = null;
    try {
      for (let n = 0; n < indexy.length; n++) {
        const s = stav.strany[indexy[n]];
        await prectiStranu(s, (p, t) => ukazPrubeh(`Strana ${indexy[n] + 1}${indexy.length > 1 ? ` (${n + 1}/${indexy.length})` : ''} – ${t}`, (n + p) / indexy.length));
        hotovo++;
        vykresliStrany();
        if (s === aktivni()) { obnovPanel(); vykresliVrstvu(); }
      }
    } catch (e) {
      chyba = e;
    } finally {
      stav.bezi = false; zrusit = null; naPrubeh = null;
      $('prubeh').hidden = true;
    }
    if (chyba && chyba.message === 'zrušeno') Dialog.info(`Čtení zrušeno (přečteno ${hotovo} z ${indexy.length}).`);
    else if (chyba) { console.error(chyba); Dialog.chyba('Čtení selhalo: ' + (chyba.message || chyba)); }
    else {
      if (indexy.includes(stav.aktivni)) prepniZalozku('text');
      Dialog.info(indexy.length > 1 ? `Přečteno ${hotovo} stran.` : 'Stránka přečtena.');
    }
    obnovPanel(); vykresliVrstvu();
  }
  async function zrusitCteni() {
    if (!stav.bezi) return;
    const z = zrusit;
    if (worker) { const w = worker; worker = null; workerJazyk = ''; try { await w.terminate(); } catch (_) { /* nic */ } }
    if (z) z();
  }

  // ---------- export ----------
  function textVse() {
    return stav.strany.map((s, i) => (stav.strany.length > 1 ? `===== Strana ${i + 1} – ${s.nazev} =====\n` : '') + (s.text || '')).join('\n\n\f');
  }
  function stahni(blob, nazev) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function kopiruj(text) {
    if (!text) return Dialog.info('Není co kopírovat – stránka ještě není přečtená.');
    try { await navigator.clipboard.writeText(text); Dialog.info('Text zkopírován.'); }
    catch (_) { const ta = $('text'); ta.select(); document.execCommand('copy'); Dialog.info('Text zkopírován.'); }
  }

  let pdfLibSlib = null;
  function nactiSkript(src) {
    return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('Nepodařilo se načíst ' + src)); document.head.appendChild(s); });
  }
  function nactiPdfLib() {
    if (!pdfLibSlib) pdfLibSlib = Promise.all([nactiSkript('lib/pdflib/pdf-lib.min.js'), nactiSkript('lib/pdflib/fontkit.umd.min.js')]).catch(e => { pdfLibSlib = null; throw e; });
    return pdfLibSlib;
  }
  async function blobPlatna(c, typ, q) { return new Promise(r => c.toBlob(r, typ, q)); }

  async function exportPdf() {
    if (!stav.strany.length) return Dialog.info('Nejdřív otevřete obrázky nebo PDF.');
    if (stav.bezi) return Dialog.info('Počkejte na dokončení čtení.');
    let cisla;
    if (stav.strany.length > 1) {
      for (;;) {
        const r = await Dialog.zeptej(`Které stránky dát do PDF? (1–${stav.strany.length}, např. 1-3, 5; prázdné = vše)`, '');
        if (r === null) return;
        try { cisla = O.parsujRozsah(r, stav.strany.length); break; } catch (e) { Dialog.chyba(e.message); }
      }
    } else cisla = [1];
    const neprectene = cisla.filter(c => !stav.strany[c - 1].vysledek).length;
    if (neprectene && !(await Dialog.potvrd(`${neprectene} ze ${cisla.length} stránek není přečteno – v PDF budou jen jako obraz bez textu. Pokračovat?`))) return;
    stav.bezi = true;
    let zruseno = false;
    zrusit = () => { zruseno = true; };
    try {
      ukazPrubeh('Načítám pdf-lib…', 0);
      await nactiPdfLib();
      const P = window.PDFLib;
      const pdf = await P.PDFDocument.create();
      pdf.registerFontkit(window.fontkit);
      const font = await pdf.embedFont(await (await fetch('lib/pdflib/LiberationSans-Regular.ttf')).arrayBuffer(), { subset: true });
      pdf.setTitle(O.nazevVystupu(stav.strany[cisla[0] - 1].nazev, ''));
      pdf.setProducer('OCR – lavionus.github.io/site (pdf-lib)');
      let opravy = 0;
      for (let n = 0; n < cisla.length; n++) {
        if (zruseno) throw new Error('zrušeno');
        const s = stav.strany[cisla[n] - 1];
        ukazPrubeh(`PDF – strana ${cisla[n]} (${n + 1}/${cisla.length})`, n / cisla.length);
        await odlehci();
        const geom = O.geometrie(await rastr(s), s.geom);
        const zprac = stav.nast.pdfObraz === 'zpracovany';
        const obr = zprac ? O.filtry(geom, stav.nast.filtry).obraz : geom;
        const c = naPlatno(obr);
        const bajty = new Uint8Array(await (await blobPlatna(c, zprac ? 'image/png' : 'image/jpeg', 0.85)).arrayBuffer());
        const img = zprac ? await pdf.embedPng(bajty) : await pdf.embedJpg(bajty);
        const rs = O.rozmerStrany(geom.width, geom.height, s.dpi);
        const page = pdf.addPage([rs.sirka, rs.vyska]);
        page.drawImage(img, { x: 0, y: 0, width: rs.sirka, height: rs.vyska });
        const v = s.vysledek;
        if (v && v.podpis === podpisGeom(s.geom)) {
          let slova = v.slova;
          if (s.upraveno) { const p = O.prenesOpravy(s.text, v.slova); if (p) slova = p; else opravy++; }
          const polozky = O.vrstvaTextu(slova, { sirkaObr: v.sirka, vyskaObr: v.vyska, sirkaStr: rs.sirka, vyskaStr: rs.vyska, sirkaTextu: (t, sz) => font.widthOfTextAtSize(t, sz) });
          const klic = page.node.newFontDictionary(font.name, font.ref);
          const ops = [P.pushGraphicsState(), P.beginText(), P.setTextRenderingMode(P.TextRenderingMode.Invisible)];
          for (const p of polozky) {
            ops.push(P.setFontAndSize(klic, p.velikost), P.setTextMatrix(p.meritkoX, 0, 0, 1, p.x, p.y), P.showText(font.encodeText(p.text)));
          }
          ops.push(P.endText(), P.popGraphicsState());
          page.pushOperators(...ops);
        }
      }
      ukazPrubeh('Ukládám PDF…', 1);
      const data = await pdf.save();
      stahni(new Blob([data], { type: 'application/pdf' }), O.nazevVystupu(stav.strany[cisla[0] - 1].nazev.replace(/ – str\. \d+$/, ''), '-ocr.pdf'));
      Dialog.info('PDF uloženo.' + (opravy ? ` U ${opravy} str. se změnil počet slov – vrstva má původní rozpoznaný text.` : ''));
    } catch (e) {
      if (e.message === 'zrušeno') Dialog.info('Export zrušen.');
      else { console.error(e); Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e.message || e)); }
    } finally {
      stav.bezi = false; zrusit = null; $('prubeh').hidden = true;
    }
  }

  // ---------- příkazy ----------
  async function narovnej(s) {
    const g = Object.assign({}, s.geom, { uhel: 0, orez: null });
    const img = O.geometrie(await nahledRastr(s), g);
    s.geom.uhel = -O.odhadSklonu(img);
    return s.geom.uhel;
  }
  async function vyberRozsah(text) {
    const r = await Dialog.zeptej(text + ` (1–${stav.strany.length}, např. 1-3, 5, 8-)`, '');
    if (r === null) return null;
    try { return O.parsujRozsah(r, stav.strany.length).map(c => c - 1); } catch (e) { Dialog.chyba(e.message); return null; }
  }
  const PRIKAZY = {
    otevrit: () => $('soubor').click(),
    vlozit: async () => {
      if (!navigator.clipboard || !navigator.clipboard.read) return Dialog.info('Stiskněte Ctrl+V – prohlížeč nedovoluje číst schránku tlačítkem.');
      try {
        const polozky = await navigator.clipboard.read(), soubory = [];
        for (const p of polozky) { const t = p.types.find(x => x.startsWith('image/')); if (t) soubory.push(new File([await p.getType(t)], 'schránka.' + t.split('/')[1], { type: t })); }
        if (!soubory.length) return Dialog.info('Ve schránce není obrázek.');
        await pridejSoubory(soubory);
      } catch (_) { Dialog.info('Schránku nejde přečíst – použijte Ctrl+V.'); }
    },
    ukazka,
    odebrat: async () => {
      const s = aktivni(); if (!s || stav.bezi) return;
      if (s.vysledek && !(await Dialog.potvrd(`Odebrat stránku „${s.nazev}“ i s přečteným textem?`))) return;
      stav.strany.splice(stav.aktivni, 1);
      vyberStranu(Math.min(stav.aktivni, stav.strany.length - 1));
    },
    zavritVse: async () => {
      if (!stav.strany.length || stav.bezi) return;
      if (!(await Dialog.potvrd('Zavřít všechny stránky? Přečtený text se ztratí.'))) return;
      stav.strany = []; mezipamet.clear(); stav.aktivni = -1; obnovVse();
    },
    vlevo: () => otoc90(-1), vpravo: () => otoc90(1),
    narovnat: async () => {
      const s = aktivni(); if (!s) return;
      const u = await narovnej(s);
      obnovPanel(); prekresli();
      Dialog.info(u ? `Natočeno o ${u.toLocaleString('cs')}°.` : 'Stránka je rovná.');
    },
    narovnatVse: async () => {
      if (!stav.strany.length) return;
      for (let i = 0; i < stav.strany.length; i++) { ukazPrubeh(`Narovnávám stranu ${i + 1}/${stav.strany.length}`, i / stav.strany.length); await odlehci(); await narovnej(stav.strany[i]); }
      $('prubeh').hidden = true; obnovPanel(); prekresli();
      Dialog.info('Stránky narovnány.');
    },
    zrusOrez: () => { const s = aktivni(); if (s && s.geom.orez) { s.geom.orez = null; obnovPanel(); prekresli(); } },
    seradRadky: () => seradit('radky'), seradSloupce: () => seradit('sloupce'),
    smazOblasti: () => { const s = aktivni(); if (s) { s.oblasti = []; obnovOblasti(); vykresliVrstvu(); } },
    geomVsem: async () => {
      const s = aktivni(); if (!s || stav.strany.length < 2) return;
      if (!(await Dialog.potvrd('Použít otočení, natočení a ořez této stránky na všechny ostatní?'))) return;
      stav.strany.forEach(t => { if (t !== s) { t.geom = JSON.parse(JSON.stringify(s.geom)); t.oblasti = []; } });
      vykresliStrany();
    },
    nahled: () => { stav.zpracovany = !stav.zpracovany; $('tlNahled').setAttribute('aria-pressed', String(stav.zpracovany)); $('tlNahled').querySelector('.txt').textContent = stav.zpracovany ? ' Zpracovaný' : ' Původní'; prekresli(); },
    zoom: () => { stav.plnaVelikost = !stav.plnaVelikost; $('tlZoom').setAttribute('aria-pressed', String(stav.plnaVelikost)); $('okno').classList.toggle('plna', stav.plnaVelikost); },
    cti: () => { if (!aktivni()) return Dialog.info('Nejdřív otevřete obrázek nebo PDF.'); ctiStrany([stav.aktivni]); },
    ctiVse: () => { if (!stav.strany.length) return Dialog.info('Nejdřív otevřete obrázky nebo PDF.'); ctiStrany(stav.strany.map((_, i) => i)); },
    ctiRozsah: async () => { if (!stav.strany.length) return; const r = await vyberRozsah('Které stránky přečíst?'); if (r) ctiStrany(r); },
    ctiNeprectene: () => {
      const r = stav.strany.map((s, i) => (s.vysledek ? -1 : i)).filter(i => i >= 0);
      if (!r.length) return Dialog.info('Všechny stránky jsou přečtené.');
      ctiStrany(r);
    },
    zrusit: zrusitCteni,
    kopiruj: () => kopiruj(aktivni() ? aktivni().text : ''),
    kopirujVse: () => kopiruj(stav.strany.some(s => s.text) ? textVse() : ''),
    txt: () => { const s = aktivni(); if (!s || !s.text) return Dialog.info('Stránka zatím nemá text.'); stahni(new Blob([s.text], { type: 'text/plain;charset=utf-8' }), O.nazevVystupu(s.nazev, '.txt')); },
    txtVse: () => { if (!stav.strany.some(s => s.text)) return Dialog.info('Zatím není přečtená žádná stránka.'); stahni(new Blob([textVse()], { type: 'text/plain;charset=utf-8' }), O.nazevVystupu(stav.strany[0].nazev.replace(/ – str\. \d+$/, ''), '.txt')); },
    pdf: exportPdf,
    vychozi: () => { stav.nast.filtry = Object.assign({}, O.VYCHOZI); uloz(); obnovPanel(); prekresli(); },
    napoveda: () => $('napoveda').showModal(),
  };
  function otoc90(k) {
    const s = aktivni(); if (!s) return;
    s.geom.otoceni90 = ((s.geom.otoceni90 || 0) + k + 4) % 4;
    if (s.geom.orez || s.oblasti.length) { s.geom.orez = null; s.oblasti = []; Dialog.info('Ořez a oblasti byly po otočení zrušeny.'); }
    obnovPanel(); vykresliStrany(); prekresli();
  }
  function seradit(jak) {
    const s = aktivni(); if (!s || s.oblasti.length < 2) return;
    s.oblasti = O.seradOblasti(s.oblasti, jak); obnovOblasti(); vykresliVrstvu();
  }

  // nabídky lišty
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
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](); }
    const r = e.target.closest('[data-rezim]');
    if (r) return nastavRezim(r.dataset.rezim);
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  $('napovedaZavrit').addEventListener('click', () => $('napoveda').close());

  // soubory: výběr, přetažení, schránka
  $('soubor').addEventListener('change', e => { pridejSoubory(e.target.files); e.target.value = ''; });
  let hloubka = 0;
  addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { hloubka++; document.body.classList.add('pretahovani'); } });
  addEventListener('dragleave', () => { if (--hloubka <= 0) { hloubka = 0; document.body.classList.remove('pretahovani'); } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); hloubka = 0; document.body.classList.remove('pretahovani'); if (e.dataTransfer) pridejSoubory(e.dataTransfer.files); });
  addEventListener('paste', e => {
    if (e.target && e.target.id === 'text') return;   // vkládání do textu nechat textu
    const soubory = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (soubory.length) { e.preventDefault(); pridejSoubory(soubory.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `schránka ${new Date().toLocaleTimeString('cs')}${i ? '-' + i : ''}.png`, { type: f.type })))); }
  });

  // klávesy
  addEventListener('keydown', e => {
    const vPoli = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { if (document.querySelector('.nabidka:not([hidden])')) return zavriNabidky(); if (stav.bezi) return zrusitCteni(); return; }
    if (e.key === 'F1') { e.preventDefault(); return PRIKAZY.napoveda(); }
    if (ctrl && e.key === 'Enter') { e.preventDefault(); return e.shiftKey ? PRIKAZY.ctiVse() : PRIKAZY.cti(); }
    if (ctrl && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); return PRIKAZY.otevrit(); }
    if (ctrl && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return PRIKAZY.txtVse(); }
    if (ctrl && e.shiftKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); return PRIKAZY.kopiruj(); }
    if (vPoli || ctrl || e.altKey || document.querySelector('dialog[open]')) return;
    const mapa = { '1': () => nastavRezim('slova'), '2': () => nastavRezim('oblast'), '3': () => nastavRezim('orez'), '[': PRIKAZY.vlevo, ']': PRIKAZY.vpravo, a: PRIKAZY.narovnat, p: PRIKAZY.nahled, z: PRIKAZY.zoom,
      PageUp: () => vyberStranu(stav.aktivni - 1), PageDown: () => vyberStranu(stav.aktivni + 1), Delete: PRIKAZY.odebrat };
    const f = mapa[e.key] || mapa[e.key.toLowerCase()];
    if (f) { e.preventDefault(); f(); }
  });

  // start
  nastavRezim('slova');
  obnovVse();
  window.OCR_APP = { stav, pridejSoubory, ukazka, ctiStrany, prekresli: prekresliHned, exportPdf, skocNaSlovo, PRIKAZY };
})();
