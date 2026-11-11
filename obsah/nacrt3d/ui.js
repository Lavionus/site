/* Z náčrtu do 3D – rozhraní: lišta a nabídky, uložení kresby, napojení papíru a výkladu, kontrola, výběr, tisk do PDF. */
(function (N) {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC_NAST = 'webapp_nacrt3d_nastaveni', KLIC_VYKRES = 'webapp_nacrt3d_vykres';
  const nacti = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const nast = Object.assign({ nastroj: 'obrys', prichyt: true, surove: false, vysledek: true }, nacti(KLIC_NAST));
  const vykres = Object.assign({ verze: 1, typ: 'plochy', format: 'A4', tloustka: null, prvky: [] }, nacti(KLIC_VYKRES));
  if (!N.TYPY_LISTU[vykres.typ]) vykres.typ = 'plochy';
  if (!N.FORMATY[vykres.format]) vykres.format = 'A4';
  vykres.prvky = N.ocistiPrvky(vykres.prvky);          // úložiště může obsahovat cokoli
  const ulozNast = () => { try { localStorage.setItem(KLIC_NAST, JSON.stringify(nast)); } catch (e) { /* plné úložiště nevadí */ } };
  let casUlozeni = 0;
  const ulozVykres = () => {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => {
      try { localStorage.setItem(KLIC_VYKRES, JSON.stringify(vykres)); }
      catch (e) { info('Kresbu se nepodařilo uložit (plné úložiště prohlížeče).'); }
    }, 400);
  };

  // ------------------------------------------------------------ kresliče
  const PISMO = '"Liberation Sans", Arial, Helvetica, sans-serif';
  /** Kreslič na plátno: s = px na mm, (ox, oy) = posun listu v px. */
  N.kreslicPlatna = function (ctx, s, ox = 0, oy = 0) {
    const X = x => ox + x * s, Y = y => oy + y * s;
    const pero = (o, vychozi) => {
      ctx.strokeStyle = o.barva || '#000';
      ctx.lineWidth = Math.max(0.6, (o.sila || vychozi) * s);
      ctx.setLineDash(o.carky ? o.carky.map(v => v * s) : []);
    };
    return {
      obdelnik(x, y, w, h, o = {}) {
        if (o.plny) { ctx.fillStyle = o.barva || '#000'; ctx.fillRect(X(x), Y(y), w * s + 0.3, h * s + 0.3); return; }
        pero(o, 0.3); ctx.strokeRect(X(x), Y(y), w * s, h * s);
      },
      cara(x1, y1, x2, y2, o = {}) { pero(o, 0.3); ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); },
      kruh(x, y, r, o = {}) {
        ctx.beginPath(); ctx.arc(X(x), Y(y), r * s, 0, 2 * Math.PI);
        if (o.plny) { ctx.fillStyle = o.barva || '#000'; ctx.fill(); } else { pero(o, 0.3); ctx.stroke(); }
      },
      text(x, y, t, o = {}) {
        ctx.fillStyle = o.barva || '#000';
        ctx.font = (o.tucne ? '600 ' : '') + (o.vel || 3) * s + 'px ' + PISMO;
        ctx.textAlign = o.zarovnani || 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(t, X(x), Y(y));
      },
      tecky(body, r, barva) {
        ctx.fillStyle = barva;
        const rp = Math.max(0.7, r * s);
        for (const [x, y] of body) { ctx.beginPath(); ctx.arc(X(x), Y(y), rp, 0, 2 * Math.PI); ctx.fill(); }
      },
    };
  };

  /** Kreslič do jsPDF (jednotky mm). */
  function kreslicPdf(doc, maPismo) {
    const pero = (o, vychozi) => {
      doc.setDrawColor(o.barva || '#000000');
      doc.setLineWidth(o.sila || vychozi);
      doc.setLineDashPattern(o.carky || [], 0);
    };
    return {
      obdelnik(x, y, w, h, o = {}) {
        if (o.plny) { doc.setFillColor(o.barva || '#000000'); doc.rect(x, y, w, h, 'F'); return; }
        pero(o, 0.3); doc.rect(x, y, w, h, 'S');
      },
      cara(x1, y1, x2, y2, o = {}) { pero(o, 0.3); doc.line(x1, y1, x2, y2); },
      kruh(x, y, r, o = {}) {
        if (o.plny) { doc.setFillColor(o.barva || '#000000'); doc.circle(x, y, r, 'F'); return; }
        pero(o, 0.3); doc.circle(x, y, r, 'S');
      },
      text(x, y, t, o = {}) {
        doc.setTextColor(o.barva || '#000000');
        doc.setFont(maPismo ? 'LS' : 'helvetica', !maPismo && o.tucne ? 'bold' : 'normal');
        doc.setFontSize((o.vel || 3) * 72 / 25.4);
        doc.text(maPismo ? t : t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), x, y, { align: o.zarovnani || 'left' });
      },
      tecky(body, r, barva) {
        doc.setFillColor(barva);
        for (const [x, y] of body) doc.rect(x - r, y - r, 2 * r, 2 * r, 'F');   // čtvereček: v PDF o řád menší než kruh
      },
    };
  }

  let pismoB64 = null;
  async function nactiPismo() {
    if (pismoB64) return pismoB64;
    const b = new Uint8Array(await (await fetch('lib/pdflib/LiberationSans-Regular.ttf')).arrayBuffer());
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return (pismoB64 = btoa(s));
  }

  /** jsPDF dokument s prázdným listem. */
  async function pdfListu(typ, format) {
    const doc = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: format.toLowerCase() });
    let maPismo = false;
    try { doc.addFileToVFS('LiberationSans-Regular.ttf', await nactiPismo()); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); maPismo = true; } catch (e) { /* zůstane Helvetica bez diakritiky */ }
    N.kresliList(N.rozvrh(typ, format), kreslicPdf(doc, maPismo));
    doc.setProperties({ title: 'Z náčrtu do 3D – ' + N.TYPY_LISTU[typ].nazev + ' ' + format });
    return doc;
  }

  async function tiskPdf() {
    const tl = $('btnPdf');
    tl.disabled = true;
    try {
      (await pdfListu(vykres.typ, vykres.format)).save('nacrt3d-' + vykres.typ + '-' + vykres.format + '.pdf');
    } catch (e) {
      Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message);
    } finally { tl.disabled = false; }
  }

  // ------------------------------------------------------------ papír
  const platno = $('platno'), obal = $('plocha'), pruh = $('pruh');
  const NAPOVEDA_NASTROJU = {
    obrys: 'Obrys: kreslete plnou čarou. Po zvednutí pera se čára srovná a přichytí k mřížce.',
    skryta: 'Skrytá hrana: kreslete jedním tahem, stránka ji zobrazí čárkovaně.',
    osa: 'Osa: kreslete jedním tahem, zobrazí se čerchovaně.',
    kota: 'Kóta: táhněte od jednoho bodu ke druhému, pak napište rozměr. Klepnutím na kótu (nebo dvojklikem) ji upravíte.',
    guma: 'Guma: přejeďte přes čáry, které chcete smazat.',
    posun: 'Posun: táhněte list. Zoom kolečkem myši nebo dvěma prsty.',
    vyber: 'Výběr: klepněte na čáru nebo kótu, táhněte čtverečky (body, konce kót, poloměr). Delete smaže.',
  };
  let infoText = '';
  function info(t) { infoText = t || ''; obnovPruh(); }
  function obnovPruh() {
    const n = vykres.prvky.filter(p => p.druh !== 'kota').length, k = vykres.prvky.filter(p => p.druh === 'kota');
    const bez = k.filter(p => p.hodnota == null).length;
    pruh.textContent = infoText || NAPOVEDA_NASTROJU[nast.nastroj] || '';
    const tvar = (c, a, b, d) => c + ' ' + (c === 1 ? a : c >= 2 && c <= 4 ? b : d);
    $('pocty').textContent = n || k.length ? tvar(n, 'čára', 'čáry', 'čar') + ' · ' + tvar(k.length, 'kóta', 'kóty', 'kót') + (bez ? ` (${bez} bez čísla)` : '') : N.TYPY_LISTU[vykres.typ].popis;
  }
  const model = {
    vykres, nast,
    vysledek: null, stavKot: new Map(), popisKot: new Map(), vybrane: null,
    zmena() { ulozVykres(); obnovTlacitka(); obnovPruh(); naplanujVyklad(); },
    zmenaVyberu() { obnovVyber(); },
    info,
  };
  const papir = N.vytvorPapir(platno, obal, model);

  // ------------------------------------------------------------ výklad kresby a kontrola
  let casVykladu = 0;
  function naplanujVyklad() { clearTimeout(casVykladu); casVykladu = setTimeout(vyloz, 120); }
  function vyloz() {
    try { model.vysledek = N.zpracuj(vykres); }
    catch (e) { console.error(e); model.vysledek = { hlaseni: [{ druh: 'chyba', text: 'Výklad kresby selhal: ' + e.message }], koty: [] }; }
    model.stavKot = new Map(model.vysledek.koty.map(k => [k.id, k.stav]));
    model.popisKot = new Map(model.vysledek.koty.map(k => [k.id, k.popis]));
    obnovKontrolu(); papir.prekresli();
  }
  const IKONA = { chyba: '⛔', varovani: '⚠️', info: 'ℹ️', ok: '✅' };
  function obnovKontrolu() {
    const h = (model.vysledek && model.vysledek.hlaseni) || [];
    const tl = $('btnKontrola'), nej = h.find(x => x.druh === 'chyba') || h.find(x => x.druh === 'varovani') || h.find(x => x.druh === 'ok') || h[0];
    tl.hidden = !h.length;
    const pocet = h.filter(x => x.druh === 'chyba' || x.druh === 'varovani').length;
    tl.textContent = (nej ? IKONA[nej.druh] : '') + (pocet ? ' ' + pocet : '') + ' Kontrola';
    tl.className = 'tl mini kontrola-' + (nej ? nej.druh : 'ok');
    const sez = $('nabKontrola');
    sez.replaceChildren(...h.map(x => {
      const b = document.createElement('button');
      b.className = 'tl hlaseni-' + x.druh;
      b.textContent = IKONA[x.druh] + ' ' + x.text;
      if (x.prvky && x.prvky.length) b.onclick = () => { zavriNabidky(); if (nast.nastroj !== 'vyber') nastroj('vyber'); papir.vyber(x.prvky[0]); };
      else b.disabled = true;                          // jen informace (volné konce jsou vyznačené oranžově na listu)
      return b;
    }));
  }
  function obnovVyber() {
    const p = model.vybrane && vykres.prvky.find(q => q.id === model.vybrane), panel = $('vyberPanel');
    panel.hidden = !p;
    if (!p) return;
    const DRUH = { cara: p.zavrena ? 'uzavřená čára' : 'čára', kruh: 'kružnice', kota: 'kóta' };
    $('vyberPopis').textContent = DRUH[p.druh] + (p.druh === 'kota' ? ' ' + (model.popisKot.get(p.id) || '') : '');
    panel.querySelectorAll('[data-pero]').forEach(b => { b.hidden = p.druh === 'kota'; b.setAttribute('aria-pressed', String(b.dataset.pero === p.pero)); });
  }
  function smazVybrane() {
    if (!model.vybrane) return;
    papir.zapamatuj();
    vykres.prvky = vykres.prvky.filter(q => q.id !== model.vybrane);
    model.vybrane = null; obnovVyber(); model.zmena(); papir.prekresli();
  }
  function peroVybraneho(pero) {
    const p = vykres.prvky.find(q => q.id === model.vybrane);
    if (!p || p.druh === 'kota' || p.pero === pero) return;
    papir.zapamatuj(); p.pero = pero; obnovVyber(); model.zmena(); papir.prekresli();
  }

  function obnovTlacitka() {
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === nast.nastroj)));
    $('btnZpet').disabled = !papir.lzeZpet(); $('btnZnovu').disabled = !papir.lzeZnovu();
    $('prepPrichyt').setAttribute('aria-pressed', String(nast.prichyt !== false));
    $('prepSurove').setAttribute('aria-pressed', String(!!nast.surove));
    $('prepVysledek').setAttribute('aria-pressed', String(nast.vysledek !== false));
    $('poleTloustka').hidden = vykres.typ !== 'plochy';
  }
  function nastroj(n) {
    if (n !== 'vyber' && model.vybrane) { model.vybrane = null; obnovVyber(); }
    nast.nastroj = n; ulozNast(); info(''); obnovTlacitka(); papir.nastavKurzor(); papir.prekresli();
  }

  // ------------------------------------------------------------ lišta a nabídky
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
  document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) zavriNabidky(); });

  const PRIKAZY = {
    zpet: () => papir.zpet(),
    znovu: () => papir.znovu(),
    prizpusob: () => papir.prizpusob(),
    priblizit: () => papir.zoom(1.25),
    oddalit: () => papir.zoom(0.8),
    prichyt: () => { nast.prichyt = nast.prichyt === false; ulozNast(); obnovTlacitka(); },
    surove: () => { nast.surove = !nast.surove; ulozNast(); obnovTlacitka(); papir.prekresli(); },
    vysledek: () => { nast.vysledek = nast.vysledek === false; ulozNast(); obnovTlacitka(); papir.prekresli(); },
    smazatVybrane: smazVybrane,
    async smazat() {
      if (!vykres.prvky.length) return;
      if (!await Dialog.potvrd('Smazat celou kresbu? (Jde vrátit tlačítkem Zpět.)')) return;
      papir.zapamatuj(); vykres.prvky = []; model.zmena(); papir.prekresli();
    },
    napoveda: () => $('napoveda').showModal(),
  };
  document.querySelectorAll('[data-prikaz]').forEach(b => b.addEventListener('click', () => { zavriNabidky(); PRIKAZY[b.dataset.prikaz](); }));
  document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => nastroj(b.dataset.nastroj)));

  const KLAVESY = { 1: 'obrys', 2: 'skryta', 3: 'osa', 4: 'kota', e: 'guma', h: 'posun', v: 'vyber' };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if (e.target.closest && e.target.closest('input, select, textarea, dialog')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? papir.znovu() : papir.zpet(); }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return papir.znovu(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && model.vybrane) { e.preventDefault(); smazVybrane(); }
    else if (KLAVESY[k]) { e.preventDefault(); nastroj(KLAVESY[k]); }
    else if (k === 'f') PRIKAZY.prizpusob();
    else if (k === '+' || k === '=') PRIKAZY.priblizit();
    else if (k === '-') PRIKAZY.oddalit();
    else if (k === 'f1' || k === '?') { e.preventDefault(); PRIKAZY.napoveda(); }
  });

  const selTyp = $('typListu'), selFormat = $('formatListu'), vstTl = $('tloustka');
  for (const [k, t] of Object.entries(N.TYPY_LISTU)) selTyp.add(new Option(t.nazev, k));
  selTyp.value = vykres.typ; selFormat.value = vykres.format;
  vstTl.value = vykres.tloustka != null ? String(vykres.tloustka).replace('.', ',') : '';
  selTyp.onchange = async () => {
    // jiný typ listu má jiné rámečky – kresba by mohla skončit mimo pohledy
    if (vykres.prvky.length && !await Dialog.potvrd('Změnit typ listu? Kresba zůstane, ale rámečky pohledů se změní a čáry mimo ně se nebudou počítat.')) {
      selTyp.value = vykres.typ; return;
    }
    vykres.typ = selTyp.value; model.zmena(); papir.zmenaListu(); obnovTlacitka();
  };
  selFormat.onchange = () => { vykres.format = selFormat.value; model.zmena(); papir.zmenaListu(); };
  vstTl.onchange = () => {
    const v = parseFloat(vstTl.value.replace(',', '.'));
    vykres.tloustka = isFinite(v) && v > 0 ? v : null;
    vstTl.classList.toggle('spatne', vstTl.value.trim() !== '' && vykres.tloustka == null);
    model.zmena(); papir.zmenaPozadi();
  };
  $('btnPdf').onclick = tiskPdf;
  $('napovedaZavrit').onclick = () => $('napoveda').close();
  addEventListener('resize', zavriNabidky);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => papir.zmenaPozadi());
  document.querySelectorAll('#vyberPanel [data-pero]').forEach(b => b.addEventListener('click', () => peroVybraneho(b.dataset.pero)));
  obnovTlacitka(); obnovPruh(); vyloz();

  N.app = { vykres, nast, model, papir, tiskPdf, pdfListu, nastroj, vyloz };
})(N3D);
