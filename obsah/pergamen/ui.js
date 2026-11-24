/* ============================================================
   Pergamen – ui.js
   Píše se přímo do listu (contenteditable) jako ve Wordu: pás nástrojů
   formátuje označený text (písmo z knihovny webu – i vlastní nahrané,
   velikost, řez, barva, zarovnání, styl odstavce). Šifra se použije na
   textové uzly a formátování zůstane; přepínač Otevřený text / Šifra.
   Papír a ozdoby; náhled ve skutečné velikosti (mm) zmenšený na plochu;
   tisk, PNG a PDF (SVG foreignObject s vloženými písmy, jsPDF).
   Data v localStorage `webapp_pergamen`.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PERGAMEN;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KLIC = 'webapp_pergamen';
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- obrázky v IndexedDB (localStorage by na ně nestačil) ----------
     záznam {id, orig (dataURL po načtení, max 3000 px), vysledek (dataURL po úpravách), nastaveni} */
  const obrazky = {};
  let dbSlib = null;
  function db() {
    return dbSlib || (dbSlib = new Promise((ok, chyba) => {
      if (!window.indexedDB) return chyba(new Error('Prohlížeč neumí IndexedDB.'));
      const r = indexedDB.open('webapp_pergamen', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('obrazky', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    }));
  }
  const tx = (rezim, fn) => db().then(b => new Promise((ok, chyba) => { const t = b.transaction('obrazky', rezim), v = fn(t.objectStore('obrazky')); t.oncomplete = () => ok(v && v.result); t.onerror = () => chyba(t.error); }));
  const ulozObrazek = z => { obrazky[z.id] = z; return tx('readwrite', st => st.put(z)); };
  const nactiObrazky = () => tx('readonly', st => st.getAll()).then(v => { for (const z of v || []) obrazky[z.id] = z; }).catch(() => {});

  /* ---------- úložiště ---------- */
  let data = { aktivni: null, dokumenty: {} };
  try { Object.assign(data, JSON.parse(localStorage.getItem(KLIC)) || {}); } catch (e) { /* první spuštění */ }
  for (const id in data.dokumenty) data.dokumenty[id] = P.normalizuj(data.dokumenty[id]);
  let d = data.dokumenty[data.aktivni];
  if (!d) d = novy('vyprava');
  function novy(ukazka) {
    const n = P.normalizuj(Object.assign({}, ukazka ? P.UKAZKY[ukazka] : { nadpis: '', text: '' }, { id: noveId(), seed: Math.floor(Math.random() * 1e6), pecetSeed: 1 + Math.floor(Math.random() * 1e6) }));
    n.zmeneno = Date.now();
    data.dokumenty[n.id] = n; data.aktivni = n.id;
    return n;
  }
  let casUlozeni = 0;
  function uloz() {
    d.zmeneno = Date.now();
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => { zapisHistorii(); try { localStorage.setItem(KLIC, JSON.stringify(data)); } catch (e) { zprava('Uložení se nepovedlo – prohlížeč nemá místo.'); } }, 300);
  }
  /* Zpět / Znovu celého dokumentu (obrázky, pečeť, papír, šifra, nastavení i text) – snímky po uložení;
     psaní se slučuje díky zpoždění uložení. V textu má Ctrl+Z dál vlastní zpět prohlížeče. */
  let historie = [], vpred = [];
  const snimek = () => JSON.stringify(Object.assign({}, d, { zmeneno: 0 }));
  function zapisHistorii() {
    const s = snimek();
    if (historie[historie.length - 1] === s) return;
    historie.push(s); if (historie.length > 100) historie.shift();
    vpred = []; tlacitkaHistorie();
  }
  function obnovSnimek(s) {
    const n = P.normalizuj(JSON.parse(s)); n.id = d.id; n.zmeneno = Date.now();
    data.dokumenty[d.id] = d = n;
    try { localStorage.setItem(KLIC, JSON.stringify(data)); } catch (e) { /* nevadí */ }
    vybrany = null; obnovVybery(); vse(); tlacitkaHistorie();
  }
  function zpetDokument() { if (historie.length < 2) return zprava('Není co vrátit.'); vpred.push(historie.pop()); obnovSnimek(historie[historie.length - 1]); }
  function znovuDokument() { if (!vpred.length) return; const s = vpred.pop(); historie.push(s); obnovSnimek(s); }
  function tlacitkaHistorie() { const z = document.getElementById('tlDZpet'), n = document.getElementById('tlDZnovu'); if (z) z.disabled = historie.length < 2; if (n) n.disabled = !vpred.length; }
  function novaHistorie() { historie = [snimek()]; vpred = []; tlacitkaHistorie(); }
  let casZpravy = 0;
  function zprava(t) { const z = $('zprava'); z.textContent = t; z.hidden = false; clearTimeout(casZpravy); casZpravy = setTimeout(() => { z.hidden = true; }, 2800); }
  function stahni(blob, nazev) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  const souborNazev = () => (window.VYPRAVA ? VYPRAVA.bezDiakritiky(d.nadpis || 'pergamen') : 'pergamen').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pergamen';

  /* ---------- písma z knihovny webu ---------- */
  const ZALOHA = "'IM Fell English', 'Palatino Linotype', Georgia, serif";
  /* Jméno rodiny je dané id (fonty.js: 'fnt-' + id bez zvláštních znaků), takže se dá
     napsat hned; prohlížeč písmo použije, jakmile se načte – nic se nepřekresluje
     (jinak by psaní v listu ztratilo kurzor). */
  const nacitane = new Set(), rodinaNaId = {};
  const rodinaId = id => 'fnt-' + String(id).replace(/[^a-z0-9-]/gi, '');
  function pismo(id) {
    if (!id || typeof FONTY === 'undefined') return ZALOHA;
    const rod = rodinaId(id); rodinaNaId[rod] = id;
    if (!nacitane.has(id)) {
      nacitane.add(id);
      FONTY.rodina(id).then(() => setTimeout(prizpusobMeritko, 50)).catch(() => zprava('Písmo se nepodařilo načíst – použije se náhradní.'));
    }
    return `"${rod}", ${ZALOHA}`;
  }
  const PREPISY = typeof PREPIS !== 'undefined' ? PREPIS.SEZNAM.filter(p => p.id !== 'morse') : [];
  const cilPisma = () => { const p = PREPISY.find(x => x.id === d.prepis); return p && p.vlastniPismo ? p.id : 'latinka'; };
  let fontySlib = null; const vybery = [];
  const seznamFontu = () => fontySlib || (fontySlib = typeof FONTY === 'undefined' ? Promise.resolve([]) : FONTY.seznam());
  function vyberPisma(el, klic, cil, ukazka) {
    if (typeof FONTY === 'undefined') { el.textContent = 'Knihovna písem není k dispozici.'; return; }
    const vyb = FONTY.vyberFontu(el, {
      ukazka, doporucene: cil, filtr: f => f.vlastni || f.pismo === cil(),
      onZmena: id => { d[klic] = id; uloz(); vykresli(); },
      onNahrat: () => $('souborFontu').click(),
      onSmazat: async f => {
        if (!(await Dialog.potvrd(`Smazat font „${f.nazev}“? Zmizí ze všech stránek webu.`, { ok: 'Smazat' }))) return;
        await FONTY.smaz(f.id); obnovVybery();
      }
    });
    vybery.push({ vyb, klic });
  }
  function obnovVybery() { fontySlib = null; seznamFontu().then(sez => vybery.forEach(x => x.vyb.nastav(sez, d[x.klic]))); }
  $('souborFontu').addEventListener('change', async e => {
    let n = 0;
    for (const f of e.target.files) { try { await FONTY.pridej(f); n++; } catch (chyba) { Dialog.chyba(chyba.message); } }
    e.target.value = '';
    if (n) { obnovVybery(); zprava(n === 1 ? 'Font přidán do knihovny webu.' : `Přidáno fontů: ${n}.`); }
  });
  vyberPisma($('vyberPisma'), 'pismo', cilPisma, () => P.sifruj((d.text || '').split('\n').find(r => r.trim()) || 'Aa Čř', d).slice(0, 40));
  vyberPisma($('vyberNadpisu'), 'pismoNadpisu', () => 'latinka', () => d.nadpis || 'Listina');

  /* ---------- ovládací prvky ---------- */
  const vypln = (el, obj, fn) => { el.innerHTML = Object.entries(obj).map(([k, x]) => `<option value="${esc(k)}">${esc(fn ? fn(x) : x)}</option>`).join(''); };
  vypln($('pSifra'), P.SIFRY); vypln($('pFormat'), P.FORMATY, x => x.nazev); vypln($('pPapir'), P.PAPIRY, x => x.nazev);
  vypln($('pOkraj'), P.OKRAJE); vypln($('pRamecek'), P.RAMECKY); vypln($('pVosk'), P.VOSKY, x => x[0]); vypln($('pInicialy'), P.INICIALY);
  vypln($('pPecetStyl'), P.PECETI); vypln($('pStuha'), P.STUHY, x => Array.isArray(x) ? x[0] : x); vypln($('pVodoznak'), P.VODOZNAKY);
  $('pPrepis').innerHTML = '<option value="zadny">Bez přepisu</option>' + PREPISY.filter(p => p.id !== 'zadny').map(p => `<option value="${p.id}">${esc(p.nazev)}</option>`).join('');
  $('inkousty').insertAdjacentHTML('afterbegin', Object.entries(P.INKOUSTY).map(([b, n]) => `<button type="button" data-inkoust="${b}" title="${esc(n)}" aria-label="${esc(n)}" style="background:${b}"></button>`).join(''));
  $('inkousty').addEventListener('click', e => { const b = e.target.closest('[data-inkoust]'); if (b) { d.inkoust = b.dataset.inkoust; uloz(); vse(); } });
  /* Nabídka Ukázky: ukázkové listy + vlastní šablony vzhledu (papír, písma, rámeček, pečeť, okraje – bez textu). */
  if (!Array.isArray(data.sablony)) data.sablony = [];
  function vykresliUkazky() {
    $('nabUkazky').innerHTML = '<div class="titulek">Ukázkové listy</div>' + Object.entries(P.UKAZKY).map(([k, u]) => `<button class="tl" data-ukazka="${k}">${esc(u.nadpis)}</button>`).join('')
      + '<hr><div class="titulek">Moje šablony vzhledu</div>'
      + (data.sablony.length ? data.sablony.map((t, i) => `<div class="sablona-rad"><button class="tl" data-sablona="${i}" title="Použít vzhled na tento pergamen (text zůstane)">🎨 ${esc(t.nazev)}</button><button class="tl ik" data-smaz-sablonu="${i}" title="Smazat šablonu" aria-label="Smazat šablonu">✕</button></div>`).join('') : '<p class="pozn" style="padding:0 10px">Zatím žádné – uložte si vzhled tohoto listu.</p>')
      + '<button class="tl" data-prikaz="ulozSablonu">💾 Uložit vzhled jako šablonu…</button>';
  }
  vykresliUkazky();

  const CISELNE = new Set(['velikost', 'radkovani', 'starnuti', 'posun', 'pecetVel', 'okrajNahore', 'okrajDole', 'okrajBoky', 'inkoustStari', 'zmackani', 'kanky', 'foxing', 'vybledle', 'diry',
    'voda', 'mastnota', 'ozehnuti', 'pripaleni', 'trhliny', 'pero', 'rozpiti', 'rukopis', 'vodoznakSila', 'pecetHloubka']);
  const nahodne = () => 1 + Math.floor(Math.random() * 1e6);
  vypln($('pPreklad'), P.PREKLADY); vypln($('pRoh'), P.ROHY);
  document.querySelectorAll('[data-pole]').forEach(el => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    const k = el.dataset.pole, puv = d[k];
    d[k] = el.type === 'checkbox' ? el.checked : CISELNE.has(k) ? +el.value : el.value;
    if (k === 'pecet' && d.pecet) d.pecetSeed = nahodne();   // nová pečeť = vosk rozlitý jinak
    // k přepisu do jiného písma rovnou font, který jeho znaky má; zpět na latinku vrátit předchozí
    if (k === 'prepis') {
      const p = PREPISY.find(x => x.id === d.prepis);
      if (p && p.vlastniPismo && p.font) { if (!PREPISY.some(x => x.vlastniPismo && x.font === d.pismo)) d.pismoLatinky = d.pismo; d.pismo = p.font; }
      else if (PREPISY.some(x => x.id === puv && x.vlastniPismo)) d.pismo = d.pismoLatinky || 'imfell';
      obnovVybery();
    }
    uloz(); vse(el);
  }));

  function nastavPole(krome) {
    document.querySelectorAll('[data-pole]').forEach(el => {
      if (el === krome || el === document.activeElement && el.type !== 'checkbox' && el.tagName !== 'SELECT') return;
      const h = d[el.dataset.pole];
      if (el.type === 'checkbox') el.checked = !!h; else el.value = h ?? '';
    });
    $('hVelikost').textContent = d.velikost + ' pt';
    $('hRadkovani').textContent = d.radkovani.toFixed(2).replace('.', ',');
    $('hStarnuti').textContent = d.starnuti + ' %';
    $('polePosun').hidden = d.sifra !== 'caesar'; $('poleHeslo').hidden = d.sifra !== 'vigenere';
    $('polePecet').hidden = !d.pecet;
    $('hPecetVel').textContent = d.pecetVel + ' mm';
    $('hInkoustStari').textContent = d.inkoustStari ? d.inkoustStari + ' %' : 'čerstvý';
    for (const k of ['zmackani', 'kanky', 'foxing', 'vybledle', 'voda', 'mastnota', 'ozehnuti', 'pero', 'rozpiti', 'rukopis']) $('h' + k[0].toUpperCase() + k.slice(1)).textContent = d[k] ? d[k] + ' %' : 'ne';
    for (const k of ['diry', 'pripaleni', 'trhliny']) $('h' + k[0].toUpperCase() + k.slice(1)).textContent = d[k] || 'žádné';
    $('poleVodoznak').hidden = d.vodoznak === 'zadny'; $('hVodoznakSila').textContent = d.vodoznakSila + ' %';
    $('polePecetObr').hidden = !d.pecetObr; $('tlPecetObrUpravit').disabled = $('tlPecetObrOdebrat').disabled = !d.pecetObr;
    $('hPecetHloubka').textContent = d.pecetHloubka + ' %';
    $('tlListy').classList.toggle('aktivni', !!(d.dalsi.length || d.rub || d.obalka));
    const posk = d.preklad !== 'zadne' || d.zmackani || d.kanky || d.diry || d.roh !== 'zadny' || d.foxing || d.otisk || d.vybledle
      || d.voda || d.mastnota || d.ozehnuti || d.pripaleni || d.trhliny;
    $('tlPoskozeni').classList.toggle('aktivni', !!posk);
    $('vzorInkoustu').style.background = d.inkoust;
    $('tlSifra').classList.toggle('aktivni', sifrovano());
    $('pRozsah').disabled = d.klic === 'zadny';
    document.querySelectorAll('[data-inkoust]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.inkoust === d.inkoust)));
    $('hlaseni').innerHTML = P.kontrola(sTextemListu()).map(t => `<li>${esc(t)}</li>`).join('');
  }

  /* ---------- obsah listu: čištění, šifrování HTML ---------- */
  const STYLY_SPAN = ['font-family', 'font-size', 'color', 'text-decoration', 'text-decoration-line', 'font-weight', 'font-style'];
  const BLOKY = new Set(['P', 'H2', 'BLOCKQUOTE']);
  const POVOLENE = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'H2', 'BLOCKQUOTE', 'IMG']);
  /* Ponechá jen bezpečné značky a styly (vložený text z webu, starší data, zásahy execCommand).
     Obrázek v textu se ukládá jen odkazem do IndexedDB (data-obr), obtékáním a šířkou v %.
     radek = jednořádkové pole (nadpis, datum, podpis) – bez odstavců. */
  function cisty(html, radek) {
    const t = document.createElement('template'); t.innerHTML = html || '';
    const projdi = el => {
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 3) continue;
        if (n.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|svg)$/i.test(n.tagName)) { n.remove(); continue; }
        projdi(n);
        let e = n;
        if (e.tagName === 'DIV') { const p = document.createElement('p'); p.append(...e.childNodes); for (const a of ['style']) if (e.hasAttribute(a)) p.setAttribute(a, e.getAttribute(a)); e.replaceWith(p); e = p; }
        if (e.tagName === 'FONT') {   // starší execCommand bez CSS
          const sp = document.createElement('span'); sp.append(...e.childNodes);
          if (e.color) sp.style.color = e.color;
          if (e.face) sp.style.fontFamily = e.face;
          e.replaceWith(sp); e = sp;
        }
        if (!POVOLENE.has(e.tagName)) { e.replaceWith(...e.childNodes); continue; }
        if (e.tagName === 'IMG') {
          const id = e.dataset.obr, ob = e.dataset.obtekani, w = +e.dataset.sirka;
          for (const a of [...e.attributes]) e.removeAttribute(a.name);
          if (!/^o[a-z0-9]+$/i.test(id || '') || radek) { e.remove(); continue; }
          e.setAttribute('data-obr', id);
          e.setAttribute('data-obtekani', /^(left|right|center)$/.test(ob) ? ob : 'left');
          e.setAttribute('data-sirka', String(w >= 5 && w <= 100 ? Math.round(w) : 40));
          continue;
        }
        const st = e.style, nove = [];
        if (BLOKY.has(e.tagName) && /^(left|right|center|justify)$/.test(st.textAlign)) nove.push('text-align:' + st.textAlign);
        if (e.tagName === 'SPAN' || e.tagName === 'B' || e.tagName === 'I') for (const k of STYLY_SPAN) {
          let v = st.getPropertyValue(k);
          if (!v) continue;
          if (k === 'font-family') { const m = /fnt-[a-z0-9-]+/i.exec(v); if (!m) continue; v = `"${m[0]}", ${ZALOHA}`; if (rodinaNaId[m[0]]) e.dataset.font = rodinaNaId[m[0]]; }
          if (k === 'font-size' && !/^[\d.]+(pt|px|em|%)$/.test(v)) continue;
          if (k === 'color' && !/^(#[0-9a-f]{3,8}|rgba?\([\d., ]+\))$/i.test(v)) continue;
          nove.push(k + ':' + v);
        }
        const font = e.dataset.font;
        // ruční opravy: škrt, začernění, oprava připsaná nad slovem
        const trida = e.tagName === 'SPAN' && /^(skrt|zacerneni)$/.test(e.className) ? e.className : '';
        const oprava = e.tagName === 'SPAN' && e.hasAttribute('data-oprava') ? e.getAttribute('data-oprava').slice(0, 200) : null;
        for (const a of [...e.attributes]) e.removeAttribute(a.name);
        if (nove.length) e.setAttribute('style', nove.join(';'));
        if (font && /fnt-/.test(nove.join())) e.setAttribute('data-font', font);
        if (trida) e.className = trida;
        if (oprava != null) e.setAttribute('data-oprava', oprava);
      }
    };
    projdi(t.content);
    if (radek) {   // jednořádkové pole: bloky rozpustit, konce řádků pryč
      t.content.querySelectorAll('p,h2,blockquote').forEach(b => { b.after(' '); b.replaceWith(...b.childNodes); });
      t.content.querySelectorAll('br').forEach(b => b.replaceWith(' '));
      return t.innerHTML.trim();
    }
    // volný text a vnořené bloky v kořeni zabalit do odstavců
    const out = document.createElement('div'); let p = null;
    for (const n of [...t.content.childNodes]) {
      if (n.nodeType === 1 && BLOKY.has(n.tagName)) { out.append(n); p = null; }
      else { if (!p) { p = document.createElement('p'); out.append(p); } p.append(n); }
    }
    return out.innerHTML || '<p><br></p>';
  }
  /* Šifra na textových uzlech – formátování zůstane. Vigenère pokračuje v hesle přes uzly;
     pozpátku obrátí znaky v uzlu a pořadí uzlů v každém řádku. */
  function obratRadky(blok) {
    const obrat = el => { const deti = [...el.childNodes]; for (const n of deti) if (n.nodeType === 1) obrat(n); el.append(...deti.reverse()); };
    const segmenty = [[]];
    for (const n of [...blok.childNodes]) { if (n.nodeName === 'BR') segmenty.push([n]); else segmenty[segmenty.length - 1].push(n); }
    blok.textContent = '';
    for (const sg of segmenty) {
      const br = sg[0] && sg[0].nodeName === 'BR' ? sg.shift() : null;
      if (br) blok.append(br);
      for (const n of sg) if (n.nodeType === 1) obrat(n);
      blok.append(...sg.reverse());
    }
  }
  /* start = písmena na předchozích listech (Vigenère pokračuje v hesle na dalším listu). */
  function sifrovanyHtml(html, start) {
    if (d.sifra === 'zadna' && (!d.prepis || d.prepis === 'zadny')) return html;
    const t = document.createElement('template'); t.innerHTML = html;
    const tw = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT);
    let pocet = start || 0, n;
    while ((n = tw.nextNode())) { const puv = n.nodeValue; n.nodeValue = P.sifruj(puv, d, pocet); pocet += P.pocetPismen(puv); }
    t.content.querySelectorAll('[data-oprava]').forEach(e => { e.dataset.oprava = P.sifruj(e.dataset.oprava, d, 0); });
    if (d.sifra === 'pozpatku') t.content.querySelectorAll('p,h2,blockquote').forEach(obratRadky);
    return t.innerHTML;
  }
  const sifrovano = () => d.sifra !== 'zadna' || (d.prepis && d.prepis !== 'zadny');
  let pohled = 'sifra';   // 'text' = otevřený text k úpravám, 'sifra' = jak se vytiskne
  let exportuje = false;
  let vybrany = null;   // {typ:'obr', i} | {typ:'pecet'} – vybraný prvek na listu
  const upravy = () => !exportuje && (!sifrovano() || pohled === 'text');

  /* Dokument s textem ze všech listů (klíč „jen znaky ze zprávy“ a upozornění šifry). */
  const sTextemListu = () => Object.assign({}, d, { text: [d.text, ...d.dalsi.map(x => { const t = document.createElement('template'); t.innerHTML = x.html || ''; return t.content.textContent; })].join('\n') });
  function obnovKlicAHlaseni() {
    if (d.klic !== 'zadny' && d.rozsahKlice === 'pouzite') document.querySelectorAll('.klic-misto').forEach(k => { k.innerHTML = klicHtml(); });
    $('hlaseni').innerHTML = P.kontrola(sTextemListu()).map(t => `<li>${esc(t)}</li>`).join('');
  }
  function klicHtml() {
    if (d.klic === 'zadny') return '';
    const k = P.klic(sTextemListu()), F = pismo(d.pismo);
    let obsah;
    if (d.sifra === 'vigenere') obsah = `<p class="vet">Vigenèrova šifra · heslo: <b>${esc(d.heslo || '?')}</b></p>`;
    else if (d.sifra === 'zrcadlo') obsah = '<p class="vet">Podrž list proti zrcadlu.</p>';
    else obsah = `<div class="mrizka">${k.map(([o, z]) => `<span class="bunka"><span class="o">${esc(o)}</span><span class="z" style="font-family:${esc(F)}">${esc(z)}</span></span>`).join('')}</div>`
      + (d.sifra === 'pozpatku' ? '<p class="vet">Řádky čti zprava doleva.</p>' : '');
    return `<div class="klic"><h2>Klíč</h2>${obsah}</div>`;
  }
  function ozdoby() {
    let s = '';
    const F = P.FORMATY[d.format] || P.FORMATY.a4;
    s += P.ramecekSvg(d.ramecek, F.w, F.h, d.inkoust);
    if (d.ramecek === 'jednoduchy' || d.ramecek === 'rohyLinka') s += '<div class="ramecek"></div>';
    if (d.ramecek === 'dvojity') s += '<div class="ramecek dvojity"></div>';
    if (d.ramecek === 'rohy' || d.ramecek === 'rohyLinka') {
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(P.rohSvg(d.inkoust));
      s += ['lh', 'ph', 'ld', 'pd'].map(r => `<img class="roh ${r}" src="${url}" alt="">`).join('');
    }
    return s;
  }
  /* Obrázky v textu: src a šířka se doplní z IndexedDB až při vykreslení (v datech je jen odkaz). */
  function doplnObrazky(html) {
    if (!/data-obr/.test(html)) return html;
    const t = document.createElement('template'); t.innerHTML = html;
    t.content.querySelectorAll('img[data-obr]').forEach(i => {
      const z = obrazky[i.dataset.obr];
      if (z) { i.src = z.vysledek; i.style.width = (+i.dataset.sirka || 40) + '%'; i.draggable = false; } else i.remove();
    });
    return t.innerHTML;
  }
  /* Jednořádkové pole v listu (nadpis, podpis, datum) – formátuje se pásem jako text.
     Při úpravách vždy, jinak jen když není prázdné. */
  function pole(tag, trida, klic, zastupny, styl) {
    const e = upravy();
    if (!e && !String(d[klic] || '').trim()) return '';
    const obsah = typeof d[klic + 'Html'] === 'string' ? d[klic + 'Html'] : esc(d[klic] || '');
    return `<${tag} class="${trida}"${e ? ` contenteditable="true" spellcheck="false" data-pole-listu="${klic}" data-zastupny="${esc(zastupny)}"` : ''}${styl ? ` style="${styl}"` : ''}>${obsah}</${tag}>`;
  }
  /* Iniciála přebírá písmo a barvu, kterou uživatel dal prvnímu písmenu; jinak výchozí. */
  function iniTridy(html) {
    const t = document.createElement('template'); t.innerHTML = html;
    const p = t.content.querySelector('p'); if (!p) return '';
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode()) && !n.nodeValue.trim());
    if (!n) return '';
    let pis = false, bar = false;
    for (let e = n.parentElement; e && e !== p; e = e.parentElement) { if (e.style.fontFamily) pis = true; if (e.style.color) bar = true; }
    return (pis ? ' ini-vlastni-pismo' : '') + (bar ? ' ini-vlastni-barva' : '');
  }
  const stylListu = (F, pap) => {
    const V = P.VOSKY[d.vosk] || P.VOSKY.cervena;
    return `width:${F.w}mm;height:${F.h}mm;background-image:url('${pap}');--ink:${d.inkoust};--vosk-a:${V[1]};--vosk-b:${V[2]};--pismo-nadpisu:${esc(pismo(d.pismoNadpisu))};--pismo-iniciala:${esc(d.pismoIniciala === 'text' ? pismo(d.pismo) : pismo(d.pismoNadpisu))};font-size:${d.velikost}pt;line-height:${d.radkovani}`;
  };
  const maskaStyl = m => (m ? `;-webkit-mask-image:url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(m)}');mask-image:url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(m)}');-webkit-mask-size:100% 100%;mask-size:100% 100%` : '');
  /* Filtr inkoustu pro text jednoho listu (vlastní id – vodní skvrny jsou na každém listu jinde). */
  function filtrListu(fid, F, dd, rub) {
    if (!P.inkoustEfekty(d)) return '';
    const vs = d.voda ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(P.vodaMaskaSvg(dd, F.w, F.h, rub)) : '';
    return P.filtrInkoustu(d.inkoustStari, d.seed, { pero: d.pero, rozpiti: d.rozpiti, rukopis: d.rukopis, voda: d.voda, vodaSvg: vs, ox: d.okrajBoky * PX_MM, oy: d.okrajNahore * PX_MM, w: F.w * PX_MM, h: F.h * PX_MM, id: fid });
  }
  const obsahStyl = fid => `inset:${d.okrajNahore}mm ${d.okrajBoky}mm ${d.okrajDole}mm${P.inkoustEfekty(d) ? `;filter:url(#${fid})` : ''}`;
  /* Místo, datum, podpis a klíč dole – na posledním listu s textem. */
  function pataHtml() {
    const datum = pole('span', 'datum', 'datum', 'Místo a datum', `font-family:${esc(pismo(d.pismo))}`), podpis = pole('span', 'podpis', 'podpis', 'Podpis', `font-family:${esc(pismo(d.pismoNadpisu))}`);
    return (datum || podpis ? `<div class="pata">${datum || '<span></span>'}${podpis}</div>` : '')
      + `<div class="klic-misto">${d.klic === 'dole' ? klicHtml() : ''}</div>`;
  }
  const tridyTela = (sif, e) => `${sif && d.sifra === 'zrcadlo' && !e ? ' zrcadlo' : ''}${sif && !e && cilPisma() !== 'latinka' ? ' vlastni-pismo' : ''}`;
  function listHtml(listek) {
    const F = P.FORMATY[listek ? 'a6' : d.format] || P.FORMATY.a4;
    const pap = P.papirDataUrl(Object.assign({}, d, { format: listek ? 'a6' : d.format, seed: d.seed + (listek ? 31 : 0) }));
    const styl = stylListu(F, pap);
    if (listek) {
      return `<div class="list listek" style="${styl};font-size:${Math.min(d.velikost, 13)}pt" data-i18n="ne">${d.ramecek !== 'zadny' ? '<div class="ramecek"></div>' : ''}<div class="obsah">`
        + `<h1 class="nadpis" style="font-family:${esc(pismo(d.pismoNadpisu))};font-size:1.6em">${esc(d.nadpis || 'Klíč')}</h1><div class="klic-misto">${klicHtml()}</div></div></div>`;
    }
    const e = upravy();
    const ini = d.inicialy !== 'zadna' && !(d.sifra === 'zrcadlo' && !e) ? ' ini' + (d.inicialy === 'cervena' ? ' ini-cervena' : '') + iniTridy(d.html) : '';
    const telo = doplnObrazky(e ? d.html : sifrovanyHtml(d.html));
    const nadpis = pole('h1', 'nadpis', 'nadpis', 'Nadpis', `font-family:${esc(pismo(d.pismoNadpisu))};text-align:${d.nadpisZar}`);
    // poničení: přes list překryv (lomy, zmačkání, kaňky…), díry a utržený roh maskou – je jimi vidět skrz
    const pk = P.poskozeni(d, F.w, F.h, { id: 'hl' });
    return `<div class="list${e ? ' upravy' : ''}" id="hlavniList" style="${styl}${maskaStyl(pk.maska)}" data-i18n="ne">${filtrListu('inkoustStary', F, d)}${ozdoby()}<div class="obsah" style="${obsahStyl('inkoustStary')}">${nadpis}`
      + `<div class="telo${ini}${tridyTela(true, e)}" id="telo"${e ? ' contenteditable="true" spellcheck="true" lang="cs"' : ''} style="font-family:${esc(pismo(d.pismo))};text-align:${d.zarovnani}">${telo}</div>`
      + (d.dalsi.length ? '' : pataHtml()) + '</div>'
      + prvkyHtml(F) + pk.prekryv + '</div>';
  }
  /* Další list (pokračování textu), rub hlavního listu (papír i poničení zrcadlově, inkoust
     z líce jen prosvítá) a obálka – střih C6 na A4 s adresou a pečetí na horní chlopni. */
  const pismenHtml = h => { const t = document.createElement('template'); t.innerHTML = h || ''; return P.pocetPismen(t.content.textContent); };
  const startSifry = i => pismenHtml(d.html) + d.dalsi.slice(0, i).reduce((s, x) => s + pismenHtml(x.html), 0);
  const NAZVY_LISTU = { rub: '🔄 Rub listu – zadní strana', obalka: '✉️ Obálka C6 – střih na A4 (vystřihnout, ohnout, zapečetit)' };
  function vedlejsiListHtml(druh, i) {
    const e = upravy(), obalka = druh === 'obalka', rub = druh === 'rub', dalsi = druh === 'dalsi';
    const F = obalka ? { w: P.OBALKA.w, h: P.OBALKA.h } : (P.FORMATY[d.format] || P.FORMATY.a4);
    const dd = dalsi ? Object.assign({}, d, { seedPosk: d.seedPosk + 17 * (i + 1) }) : d;
    const pap = P.papirDataUrl(Object.assign({}, d, obalka ? { format: 'a4', okraj: 'rovny', vodoznak: 'zadny', seed: d.seed + 77 } : { seed: d.seed + (dalsi ? 101 * (i + 1) : 0), zrcadlit: rub }));
    const klic = dalsi ? 'dalsi-' + i : druh, zdroj = dalsi ? d.dalsi[i] : d[druh], fid = 'inkoust-' + klic;
    const html = doplnObrazky(e || !dalsi ? zdroj.html : sifrovanyHtml(zdroj.html, startSifry(i)));
    const telo = `<div class="telo${tridyTela(dalsi, e)}" data-telo-listu="${klic}"${e ? ' contenteditable="true" spellcheck="true" lang="cs"' : ''} style="font-family:${esc(pismo(d.pismo))};text-align:${obalka ? 'left' : d.zarovnani}">${html}</div>`;
    let vnitrek, maska;
    if (obalka) {
      const A = P.OBALKA.adresa, pc = P.OBALKA.pecet;
      maska = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.w} ${F.h}" width="${F.w}mm" height="${F.h}mm" preserveAspectRatio="none"><path d="${P.OBALKA.obrys}" fill="#fff" stroke="#fff" stroke-width="1.5"/></svg>`;
      vnitrek = P.obalkaSvg(d.inkoust) + `<div class="adresa" style="left:${A.x}mm;top:${A.y}mm;width:${A.w}mm;height:${A.h}mm">${telo}</div>`
        + (zdroj.pecet && d.pecet ? `<div class="pecet-obalka" style="left:${pc.x}mm;top:${pc.y}mm;width:${Math.min(d.pecetVel, 30)}mm">${pecetHtml()}</div>` : '');
    } else {
      const pk = P.poskozeni(dd, F.w, F.h, { rub, id: klic });
      maska = pk.maska;
      vnitrek = filtrListu(fid, F, dd, rub) + (dalsi ? ozdoby() : '') + `<div class="obsah" style="${obsahStyl(fid)}">${telo}${dalsi && i === d.dalsi.length - 1 ? pataHtml() : ''}</div>` + pk.prekryv;
    }
    const popisek = e ? `<div class="popisek-listu">${esc(dalsi ? `📄 ${i + 2}. list` : NAZVY_LISTU[druh])}<button class="tl" data-odebrat-list="${klic}" title="Odebrat tento list">🗑 Odebrat</button></div>` : '';
    return popisek + `<div class="list ${obalka ? 'obalka-list' : rub ? 'rub-list' : 'dalsi-list'}${e ? ' upravy' : ''}" data-list="${klic}" style="${stylListu(F, pap)}${maskaStyl(maska)}" data-i18n="ne">${vnitrek}</div>`;
  }
  /* Obrázky, kresby a pečeť – volně umístěné prvky (mm od levého horního rohu listu). */
  function polohaPecete(F) {
    if (d.pecetX != null && d.pecetY != null) return { x: d.pecetX, y: d.pecetY };
    const v = d.pecetVel;
    return d.klic === 'dole' ? { x: F.w - 16 - v, y: 14 } : { x: F.w - 26 - v, y: F.h - 34 - v };
  }
  /* Obrázek v pečeti: z výsledku editoru čtverec 220 px → výšky → stínování (P.reliefPixely).
     Počítá se jednou pro obrázek, směr a hloubku; než je hotový, pečeť má znak. */
  const reliefy = {};
  function reliefUrl() {
    const z = d.pecetObr && obrazky[d.pecetObr]; if (!z) return null;
    const inv = d.pecetInv, hl = d.pecetHloubka, k = d.pecetObr + '|' + inv + '|' + hl;
    if (k in reliefy) return reliefy[k] === 'ceka' ? null : reliefy[k];
    reliefy[k] = 'ceka';
    const img = new Image();
    img.onload = () => {
      const n = 220, c = document.createElement('canvas'); c.width = c.height = n;
      const g = c.getContext('2d'), st = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - st) / 2, (img.height - st) / 2, st, st, 0, 0, n, n);
      const px = g.getImageData(0, 0, n, n).data;
      g.putImageData(new ImageData(P.reliefPixely(P.vyskaZPixelu(px, n, inv), n, hl), n, n), 0, 0);
      reliefy[k] = c.toDataURL('image/png'); vykresli();
    };
    img.onerror = () => { reliefy[k] = null; };
    img.src = z.vysledek;
    return null;
  }
  const pecetHtml = () => P.pecetSvg({ styl: d.pecetStyl, vosk: d.vosk, stuha: d.stuha, znak: d.znakPecete, seed: d.seed, seedTvaru: d.pecetSeed, obrazek: reliefUrl(), pismo: pismo(d.pismoNadpisu) });
  function prvkyHtml(F) {
    const vyb = (typ, i) => vybrany && vybrany.typ === typ && (typ === 'pecet' || vybrany.i === i) && upravy() ? ' vybrany' : '';
    let s = d.obrazky.map((o, i) => {
      const styl = `left:${o.x}mm;top:${o.y}mm;width:${o.w}mm;transform:rotate(${o.rot}deg);opacity:${o.op};mix-blend-mode:${o.blend}`;
      if (o.kresba) {   // kresba perem nebo poznámka na okraj (v šifrovaném pohledu zašifrovaná)
        const obsah = o.kresba === 'poznamka'
          ? `<div class="pozn-text" style="font-family:${esc(pismo(d.pismo))};font-size:${o.vel}pt">${esc(upravy() ? o.text : P.sifruj(o.text, d, 0))}</div>`
          : P.kresbaSvg(o.kresba, o.seed, d.inkoust);
        return `<div class="prvek kresba${o.vrstva === 'za' ? ' za' : ''}${vyb('obr', i)}" data-prvek="obr" data-i="${i}" style="${styl}">${obsah}<span class="uchyt" data-uchyt></span></div>`;
      }
      const src = obrazky[o.id] && obrazky[o.id].vysledek;
      if (!src) return '';
      return `<div class="prvek obrazek${o.vrstva === 'za' ? ' za' : ''}${vyb('obr', i)}" data-prvek="obr" data-i="${i}" style="${styl}">`
        + `<img src="${src}" alt="" draggable="false"><span class="uchyt" data-uchyt></span></div>`;
    }).join('');
    if (d.pecet) {
      const p = polohaPecete(F);
      s += `<div class="prvek pecet${vyb('pecet')}" data-prvek="pecet" style="left:${p.x}mm;top:${p.y}mm;width:${d.pecetVel}mm">`
        + pecetHtml() + '<span class="uchyt" data-uchyt></span></div>';
    }
    return s;
  }

  /* Načíst všechna písma použitá v textu (data-font). */
  function nactiPismaTextu() {
    const t = document.createElement('template'); t.innerHTML = d.html || '';
    t.content.querySelectorAll('[data-font]').forEach(e => pismo(e.dataset.font));
  }

  /* Přiblížení náhledu: 'sirka' = na šířku plochy, 'stranka' = celý list, číslo = násobek skutečné velikosti. */
  const STUPNE = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];
  let zoom = 'sirka', meritko = 1;
  if (data.zoom === 'sirka' || data.zoom === 'stranka' || (data.zoom > 0.1 && data.zoom <= 4)) zoom = data.zoom;
  function prizpusobMeritko() {
    const m = $('meritko'), listy = $('listy'), N = $('nahled'), F = P.FORMATY[d.format] || P.FORMATY.a4;
    listy.style.transform = 'none'; m.style.width = ''; m.style.height = '';
    const w = listy.scrollWidth, h = listy.scrollHeight, prvni = listy.firstElementChild ? listy.firstElementChild.offsetHeight : h;
    // šířka se měří po zrušení zmenšení – svislý posuvník už je vidět a je tedy odečtený
    const naSirku = (N.clientWidth - 40) / w, naStranku = Math.min(naSirku, (N.clientHeight - 60) / prvni);
    meritko = zoom === 'sirka' ? Math.min(2, naSirku) : zoom === 'stranka' ? naStranku : zoom;
    // zmenšuje se vnitřní #listy, obal #meritko má rozměr výsledku – jinak by při zvětšení nad 100 % přetékal
    listy.style.transform = `scale(${meritko})`; m.style.width = w * meritko + 'px'; m.style.height = h * meritko + 'px';
    const pretika = telo => telo && telo.scrollHeight > telo.clientHeight + 2;
    const txt = String(d.text || ''), slov = (txt.match(/[\p{L}\p{N}]+/gu) || []).length;
    $('info').textContent = `${F.nazev} · ${F.w} × ${F.h} mm · ${slov} slov · ${txt.replace(/\s/g, '').length} znaků · ✍️ pište přímo do listu, obrázky a pečeť táhněte myší, pravé tlačítko = nabídka, F1 = nápověda` + ([...document.querySelectorAll('#listy .telo')].some(pretika) ? ' · ⚠ text se nevejde – 📑 Listy → ⤵ Přelít na další list, nebo zmenšete písmo (⤢ Vejít se)' : '');
    $('zoomHodnota').textContent = Math.round(meritko * 100) + ' %';
    $('zoomSirka').setAttribute('aria-pressed', String(zoom === 'sirka'));
    $('zoomStranka').setAttribute('aria-pressed', String(zoom === 'stranka'));
  }
  /* Změna přiblížení; bod pod kurzorem (nebo střed plochy) zůstane na místě. */
  function nastavZoom(novy, kx, ky) {
    const N = $('nahled'), r = N.getBoundingClientRect();
    const x = kx == null ? N.clientWidth / 2 : kx - r.left, y = ky == null ? N.clientHeight / 2 : ky - r.top;
    const px = (N.scrollLeft + x) / meritko, py = (N.scrollTop + y) / meritko;
    zoom = novy;
    data.zoom = zoom; const zm = d.zmeneno; uloz(); d.zmeneno = zm;   // přiblížení není změna dokumentu
    prizpusobMeritko();
    if (typeof zoom === 'number') { N.scrollLeft = px * meritko - x; N.scrollTop = py * meritko - y; }
  }
  const krokZoomu = (smer, kx, ky) => {
    const dalsi = smer > 0 ? STUPNE.find(z => z > meritko + 0.001) : [...STUPNE].reverse().find(z => z < meritko - 0.001);
    nastavZoom(dalsi || (smer > 0 ? STUPNE[STUPNE.length - 1] : STUPNE[0]), kx, ky);
  };
  $('nahled').addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault(); krokZoomu(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
  }, { passive: false });
  // posun přiblíženého náhledu tažením myší
  let tah = null;
  $('nahled').addEventListener('pointerdown', e => {
    const N = $('nahled');
    if ((e.button !== 0 && e.button !== 1) || e.pointerType === 'touch' || (e.button === 0 && e.target.closest('.list')) || (N.scrollWidth <= N.clientWidth && N.scrollHeight <= N.clientHeight)) return;
    if (e.button === 1) e.preventDefault();
    tah = { x: e.clientX, y: e.clientY, l: N.scrollLeft, t: N.scrollTop }; N.setPointerCapture(e.pointerId); N.classList.add('tahne');
  });
  $('nahled').addEventListener('pointermove', e => { if (tah) { const N = $('nahled'); N.scrollLeft = tah.l - (e.clientX - tah.x); N.scrollTop = tah.t - (e.clientY - tah.y); } });
  const konecTahu = () => { tah = null; $('nahled').classList.remove('tahne'); };
  $('nahled').addEventListener('pointerup', konecTahu); $('nahled').addEventListener('pointercancel', konecTahu);
  function vykresli() {
    if (vybrany && ((vybrany.typ === 'obr' && !d.obrazky[vybrany.i]) || vybrany.typ === 'txt')) vybrany = null;
    $('listy').innerHTML = listHtml(false) + (d.rub ? vedlejsiListHtml('rub') : '') + d.dalsi.map((_, i) => vedlejsiListHtml('dalsi', i)).join('')
      + (d.klic === 'listek' ? listHtml(true) : '') + (d.obalka ? vedlejsiListHtml('obalka') : '');
    stavPasu(); stavPrvku();
    $('listy').style.display = 'flex'; $('listy').style.flexDirection = 'column'; $('listy').style.gap = '22px';
    const F = P.FORMATY[d.format] || P.FORMATY.a4;
    $('tiskStyl').textContent = `@media print{@page{size:${F.w}mm ${F.h}mm;margin:0}@page obalka{size:210mm 297mm;margin:0}@page listek{size:148mm 105mm;margin:0}}`;
    prizpusobMeritko();
  }
  function vse(krome) { nactiPismaTextu(); nastavPole(krome); vykresli(); seznam(); }
  addEventListener('resize', () => prizpusobMeritko());

  /* ---------- psaní do listu a pás nástrojů ---------- */
  const telo = () => $('telo');
  let rozsah = null, posledniVelikost = null, aktivni = null;   // aktivni = editor s výběrem (tělo, nadpis, datum, podpis)
  const jeEditor = el => el && el.isConnected && el.isContentEditable && (el.id === 'telo' || el.dataset.poleListu || el.dataset.teloListu);
  const EDITORY = '#telo, .list [data-pole-listu], .list [data-telo-listu]';
  const editorUzlu = n => { const e = n && (n.nodeType === 3 ? n.parentElement : n); return e && e.closest && e.closest(EDITORY); };
  const jeTelo = el => !!el && (el.id === 'telo' || !!(el.dataset && el.dataset.teloListu));   // víc odstavců (ne jednořádkové pole)
  /* Uložit text dalšího listu, rubu nebo adresy na obálce. */
  function ulozTeloListu(el) {
    zrusNahledPisma(); prevedVelikosti(el);
    const k = el.dataset.teloListu, html = cisty(el.innerHTML);
    if (k.startsWith('dalsi-')) { const x = d.dalsi[+k.slice(6)]; if (x) x.html = html; obnovKlicAHlaseni(); } else if (d[k]) d[k].html = html;
    uloz(); prizpusobMeritko();
  }
  /* Uložit obsah jednoho editoru. */
  function ulozEditor(el) {
    if (!el) return;
    if (el.id === 'telo') return ulozText();
    if (el.dataset.teloListu) return ulozTeloListu(el);
    zrusNahledPisma();
    prevedVelikosti(el);
    const k = el.dataset.poleListu;
    d[k + 'Html'] = cisty(el.innerHTML, true); d[k] = el.textContent.replace(/\s+/g, ' ').trim();
    uloz();
    if (k === 'nadpis') { seznam(); document.querySelectorAll('.listek .nadpis').forEach(n => { n.textContent = d.nadpis || 'Klíč'; }); }
  }
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* starší prohlížeč */ }
  function ulozText() {
    const t = telo(); if (!t || !t.isContentEditable) return;
    zrusNahledPisma();
    prevedVelikosti(t);
    const tr = iniTridy(t.innerHTML);   // iniciála sleduje formát prvního písmene
    t.classList.toggle('ini-vlastni-pismo', tr.includes('pismo')); t.classList.toggle('ini-vlastni-barva', tr.includes('barva'));
    d.html = cisty(t.innerHTML); d.text = t.innerText.replace(/\n{3,}/g, '\n\n').trim();
    uloz();
    obnovKlicAHlaseni();   // klíč „jen znaky ze zprávy“ a upozornění se mění s textem
    prizpusobMeritko();
  }
  /* execCommand umí jen velikosti 1–7 – sedmičku hned přepíšeme na zvolené body. */
  function prevedVelikosti(t) {
    if (!posledniVelikost) return;
    t.querySelectorAll('span[style*="xxx-large"], font[size="7"]').forEach(e => {
      if (e.tagName === 'FONT') { const sp = document.createElement('span'); sp.append(...e.childNodes); e.replaceWith(sp); e = sp; }
      e.style.fontSize = posledniVelikost + 'pt';
    });
  }
  function obnovVyber() {
    const sel = getSelection(), nyni = sel.rangeCount && editorUzlu(sel.getRangeAt(0).commonAncestorContainer);
    if (jeEditor(nyni)) { aktivni = nyni; return true; }
    if (!jeEditor(aktivni)) aktivni = telo();
    const t = aktivni; if (!jeEditor(t)) return false;
    t.focus();
    // výběr se vrací jen tehdy, když ho ukradl jiný prvek (panel písma) – jinak platí ten současný
    if (rozsah && t.contains(rozsah.commonAncestorContainer)) { sel.removeAllRanges(); sel.addRange(rozsah); }
    return true;
  }
  function formatuj(fn) {
    if (!upravy()) { zprava('Pro úpravy přepněte na ✍️ Upravit text.'); return; }
    if (!obnovVyber()) return;
    try { document.execCommand('styleWithCSS', false, true); } catch (e) { /* nevadí */ }
    fn(aktivni);
    ulozEditor(aktivni); ulozRozsah(); stavPasu();
  }
  function ulozRozsah() {
    const sel = getSelection(), ed = sel.rangeCount && editorUzlu(sel.getRangeAt(0).commonAncestorContainer);
    if (jeEditor(ed)) { aktivni = ed; rozsah = sel.getRangeAt(0).cloneRange(); }
    zvyrazniVyber();
  }
  /* Když fokus odejde do pásu (seznam písem, velikost, barva), prohlížeč výběr v listu skryje –
     uložený výběr se proto ukáže zvýrazněním (CSS Custom Highlight; starší prohlížeč nic neukáže). */
  function zvyrazniVyber() {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    const vEditoru = jeEditor(editorUzlu(document.activeElement)) || (document.activeElement && document.activeElement.isContentEditable);
    if (!exportuje && !vEditoru && rozsah && !rozsah.collapsed && jeEditor(aktivni) && aktivni.contains(rozsah.commonAncestorContainer)) CSS.highlights.set('pergamen-vyber', new Highlight(rozsah));
    else CSS.highlights.delete('pergamen-vyber');
  }
  document.addEventListener('focusin', zvyrazniVyber);
  document.addEventListener('focusout', () => setTimeout(zvyrazniVyber, 0));
  const VELIKOSTI = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48, 60, 72];
  /* Ukázat velikost písma pod kurzorem – i takovou, která v seznamu není (doplní se dočasně). */
  function nastavVelikostPasu(pt) {
    const s = $('pasVelikost'), h = String(pt);
    s.querySelectorAll('option.docasna').forEach(o => { if (o.value !== h) o.remove(); });
    if (![...s.options].some(o => o.value === h)) {
      const o = document.createElement('option'); o.value = h; o.textContent = h; o.className = 'docasna';
      const za = [...s.options].find(x => +x.value > pt); s.insertBefore(o, za || null);
    }
    s.value = h;
  }
  $('pasVelikost').innerHTML = '<option value="">—</option>' + VELIKOSTI.map(v => `<option value="${v}">${v}</option>`).join('');
  $('pasBarvy').insertAdjacentHTML('afterbegin', Object.entries(P.INKOUSTY).concat([['#8a2414', 'Rumělka (rubrika)'], ['#7a5a14', 'Zlatohnědá']])
    .map(([b, n]) => `<button type="button" class="tl ik barva" data-barva="${b}" title="${esc(n)}" aria-label="${esc(n)}" style="background:${b}"></button>`).join(''));
  // písmo označeného textu – celá knihovna webu
  let vyberPasu = null;
  if (typeof FONTY !== 'undefined') {
    vyberPasu = FONTY.vyberFontu($('pasPismo'), {
      ukazka: () => { const sel = getSelection(); return (sel && String(sel).trim().slice(0, 30)) || 'Aa Čř'; },
      doporucene: cilPisma, filtr: f => f.vlastni || f.pismo === cilPisma(),
      onZmena: id => formatuj(() => {
        const rod = rodinaId(id); pismo(id);
        document.execCommand('fontName', false, rod);
        aktivni.querySelectorAll('[style*="font-family"]').forEach(e => { if (e.style.fontFamily.includes(rod)) e.dataset.font = id; });
      }),
      onNahrat: () => $('souborFontu').click(),
      onNahled: id => (id ? ukazNahledPisma(id) : zrusNahledPisma())
    });
    vybery.push({ vyb: vyberPasu, klic: 'pismo' });
  }
  /* Živý náhled písma: najetí na písmo v seznamu ho dočasně ukáže na označeném textu v listu
     (dočasné spany, které se po odjetí rozbalí; výběr se obnoví podle pozic znaků). */
  let nahledPisma = null;
  function offsetyVyberu(el, r) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, poz = 0, a = null, b = null;
    while ((n = tw.nextNode())) {
      if (n === r.startContainer) a = poz + r.startOffset;
      if (n === r.endContainer) b = poz + r.endOffset;
      poz += n.nodeValue.length;
    }
    return a == null || b == null ? null : [a, b];
  }
  function rozsahZOffsetu(el, a, b) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), r = document.createRange(); let n, poz = 0, s = false;
    while ((n = tw.nextNode())) {
      const L = n.nodeValue.length;
      if (!s && a <= poz + L) { r.setStart(n, a - poz); s = true; }
      if (s && b <= poz + L) { r.setEnd(n, b - poz); return r; }
      poz += L;
    }
    return null;
  }
  function ukazNahledPisma(id) {
    zrusNahledPisma();
    const el = aktivni;
    if (!rozsah || rozsah.collapsed || !jeEditor(el) || !el.contains(rozsah.commonAncestorContainer)) return;
    const off = offsetyVyberu(el, rozsah); if (!off) return;
    const rod = pismo(id), uzly = [];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) if (rozsah.intersectsNode(n) && n.nodeValue.length) uzly.push(n);
    for (let u of uzly) {
      let z = u === rozsah.startContainer ? rozsah.startOffset : 0, k = u === rozsah.endContainer ? rozsah.endOffset : u.nodeValue.length;
      if (k <= z) continue;
      if (k < u.nodeValue.length) u.splitText(k);
      if (z > 0) u = u.splitText(z);
      const sp = document.createElement('span'); sp.className = 'nahled-pisma'; sp.style.fontFamily = rod;
      u.replaceWith(sp); sp.append(u);
    }
    nahledPisma = { el, off };
    rozsah = rozsahZOffsetu(el, off[0], off[1]) || rozsah; zvyrazniVyber();
  }
  function zrusNahledPisma() {
    if (!nahledPisma) return;
    const { el, off } = nahledPisma; nahledPisma = null;
    el.querySelectorAll('span.nahled-pisma').forEach(sp => sp.replaceWith(...sp.childNodes));
    el.normalize();
    const r = rozsahZOffsetu(el, off[0], off[1]);
    if (r) { rozsah = r; if (document.activeElement && jeEditor(editorUzlu(document.activeElement))) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
    zvyrazniVyber();
  }

  $('pasVelikost').addEventListener('change', e => {
    const v = +e.target.value; if (!v) return;
    posledniVelikost = v;
    formatuj(() => document.execCommand('fontSize', false, '7'));
  });
  document.querySelectorAll('#pas [data-format]').forEach(b => {
    b.addEventListener('mousedown', e => e.preventDefault());   // výběr v listu zůstane
    b.addEventListener('click', () => {
      const f = b.dataset.format;
      if (f === 'undo' || f === 'redo') { if (obnovVyber()) { document.execCommand(f); ulozEditor(aktivni); stavPasu(); } return; }
      formatuj(ed => {
        const telo = jeTelo(ed);
        if (f.startsWith('justify') && !telo) {   // zarovnání nadpisu (datum a podpis mají místo pevné)
          if (ed.dataset.poleListu === 'nadpis') { d.nadpisZar = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'center' }[f]; ed.style.textAlign = d.nadpisZar; }
          return;
        }
        if (f === 'vymazat') { document.execCommand('removeFormat'); if (telo) document.execCommand('formatBlock', false, 'p'); }
        else document.execCommand(f);
      });
    });
  });
  $('pasBarvy').addEventListener('mousedown', e => { if (e.target.closest('[data-barva]')) e.preventDefault(); });
  $('pasBarvy').addEventListener('click', e => { const b = e.target.closest('[data-barva]'); if (b) formatuj(() => document.execCommand('foreColor', false, b.dataset.barva)); });
  $('pasBarvaVlastni').addEventListener('change', e => formatuj(() => document.execCommand('foreColor', false, e.target.value)));
  $('pasPohled').addEventListener('click', () => { pohled = pohled === 'text' ? 'sifra' : 'text'; vykresli(); if (pohled === 'text') telo() && telo().focus(); });

  /* Stav pásu podle kurzoru: písmo, velikost, řez, zarovnání. */
  function stavPasu() {
    const e = upravy(), sif = sifrovano();
    $('pas').classList.toggle('neaktivni', !e);
    $('pasPohled').hidden = !sif;
    $('pasPohled').textContent = pohled === 'text' ? '🔐 Ukázat šifru' : '✍️ Upravit text';
    $('pasPohled').title = pohled === 'text' ? 'Ukázat list tak, jak se vytiskne (zašifrovaný)' : 'Přepnout na otevřený text a psát';
    const sel = getSelection(), t = sel.rangeCount && editorUzlu(sel.anchorNode);
    if (!e || !jeEditor(t)) return;
    const uzel = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
    const cs = getComputedStyle(uzel), f = uzel.closest('[data-font]');
    const vychozi = jeTelo(t) || t.dataset.poleListu === 'datum' ? d.pismo : d.pismoNadpisu;
    if (vyberPasu) seznamFontu().then(sez => vyberPasu.nastav(sez, f ? f.dataset.font : vychozi));
    $('pasStyl').disabled = !jeTelo(t);
    nastavVelikostPasu(Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2);
    for (const k of ['bold', 'italic', 'underline', 'strikeThrough']) { const b = document.querySelector(`#pas [data-format="${k}"]`); try { b.setAttribute('aria-pressed', String(document.queryCommandState(k))); } catch (x) { /* nevadí */ } }
    const blok = (jeTelo(t) && uzel.closest('p,h2,blockquote')) || t, zar = getComputedStyle(blok).textAlign.replace('start', 'left');
    document.querySelectorAll('#pas [data-format^="justify"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.format.toLowerCase().endsWith(zar === 'justify' ? 'full' : zar))));
    $('pasStyl').value = blok.tagName === 'H2' ? 'h2' : blok.tagName === 'BLOCKQUOTE' ? 'blockquote' : 'p';
  }
  $('pasStyl').addEventListener('change', e => formatuj(ed => { if (jeTelo(ed)) document.execCommand('formatBlock', false, e.target.value); }));
  document.addEventListener('selectionchange', () => { ulozRozsah(); clearTimeout(stavPasu.c); stavPasu.c = setTimeout(stavPasu, 60); });

  $('listy').addEventListener('input', e => {
    const k = e.target.closest && e.target.closest('[data-pole-listu]');
    if (k) return ulozEditor(k);
    const tl = e.target.closest('[data-telo-listu]'); if (tl) return ulozTeloListu(tl);
    if (e.target.closest('#telo')) ulozText();
  });
  $('listy').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest('[data-pole-listu]')) { e.preventDefault(); e.target.blur(); }
  });
  /* Typografie při psaní (jako ve Skriptoriu): „uvozovky“, … , pomlčka; na začátku odstavce
     „# “ = mezititulek, „> “ = citát. */
  const textPred = (sel, k) => { const r = sel.getRangeAt(0), n = r.startContainer; return n.nodeType === 3 && r.startOffset >= k ? n.nodeValue.slice(r.startOffset - k, r.startOffset) : ''; };
  function smazPred(sel, k) { const r = sel.getRangeAt(0), nr = document.createRange(); nr.setStart(r.startContainer, r.startOffset - k); nr.setEnd(r.startContainer, r.startOffset); sel.removeAllRanges(); sel.addRange(nr); document.execCommand('delete'); }
  $('listy').addEventListener('beforeinput', e => {
    if (e.inputType !== 'insertText' || !e.data) return;
    const ed = e.target.closest && e.target.closest('#telo, [data-pole-listu], [data-telo-listu]'), sel = getSelection();
    if (!ed || !sel.rangeCount) return;
    if (e.data === ' ' && jeTelo(ed)) {
      const blok = editorUzlu(sel.anchorNode) === ed && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode).closest('p');
      if (blok) {
        const r = document.createRange(); r.setStart(blok, 0); r.setEnd(sel.anchorNode, sel.anchorOffset);
        const zac = { '#': 'h2', '>': 'blockquote' }[r.toString()];
        if (zac) { e.preventDefault(); smazPred(sel, 1); document.execCommand('formatBlock', false, zac); ulozEditor(ed); return; }
      }
    }
    if (e.data === '"') { e.preventDefault(); const ch = textPred(sel, 1); document.execCommand('insertText', false, !ch || /[\s(\[{]/.test(ch) ? '„' : '“'); }
    else if (e.data === '.' && textPred(sel, 2) === '..') { e.preventDefault(); smazPred(sel, 2); document.execCommand('insertText', false, '…'); }
    else if (e.data === ' ' && textPred(sel, 2) === ' -') { e.preventDefault(); smazPred(sel, 1); document.execCommand('insertText', false, '– '); }
  });
  // vkládá se čistý text (z webu by přišly cizí styly a písma)
  $('listy').addEventListener('paste', e => {
    if (!e.target.closest('#telo, [data-pole-listu], [data-telo-listu]')) return;
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  // klik do zašifrovaného listu přepne na úpravy
  $('listy').addEventListener('pointerdown', e => {
    if (e.button === 0 && !upravy() && !exportuje && e.target.closest('.list')) {
      pohled = 'text'; vykresli(); zprava('Upravujete otevřený text – zašifrovanou podobu ukáže 🔐 Ukázat šifru.');
      setTimeout(() => telo() && telo().focus(), 0);
    }
  });

  /* ---------- prvky na listu: výběr, posun, velikost ---------- */
  const PX_MM = 96 / 25.4;
  function vyberPrvek(v) {
    vybrany = v;
    if (v) {   // fokus pryč z textu – Delete a šipky pak patří obrázku, ne kurzoru v textu
      if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
      getSelection().removeAllRanges();
    }
    document.querySelectorAll('#hlavniList .prvek').forEach(e => {
      const je = v && e.dataset.prvek === v.typ && (v.typ === 'pecet' || +e.dataset.i === v.i);
      e.classList.toggle('vybrany', !!je);
    });
    document.querySelectorAll('#telo img.vybrany').forEach(i => i.classList.remove('vybrany'));
    if (v && v.typ === 'txt') v.el.classList.add('vybrany');
    stavPrvku();
  }
  function stavPrvku() {
    const p = $('pasObrazek'), v = vybrany;
    const o = v && v.typ === 'obr' ? d.obrazky[v.i] : null;
    // místo v pásu je vyhrazené trvale (jen neviditelné) – jinak by se pás při výběru obrázku
    // zvětšil, list poskočil a pravé tlačítko by trefilo něco jiného
    const skryt = !v || !upravy() || (v.typ === 'obr' && !o) || (v.typ === 'pecet' && !d.pecet) || (v.typ === 'txt' && !v.el.isConnected);
    p.classList.toggle('neviditelny', skryt); p.inert = skryt;
    if (skryt) return;
    p.classList.toggle('pecet', v.typ === 'pecet'); p.classList.toggle('v-textu', v.typ === 'txt');
    $('obrJednotka').textContent = v.typ === 'txt' ? '% textu' : 'mm';
    $('obrUmisteni').value = v.typ === 'txt' ? v.el.dataset.obtekani : 'volne';
    if (v.typ === 'txt') { $('pasPrvekNazev').textContent = '🖼️ Obrázek v textu'; if (document.activeElement !== $('obrSirka')) $('obrSirka').value = v.el.dataset.sirka; return; }
    p.classList.toggle('kresba', !!(o && o.kresba));
    $('pasPrvekNazev').textContent = v.typ === 'pecet' ? '🔏 Pečeť' : o.kresba === 'poznamka' ? '📝 Poznámka' : o.kresba ? '✒️ Kresba' : '🖼️ Obrázek';
    $('obrUpravit').textContent = o && o.kresba ? (o.kresba === 'poznamka' ? '✎ Text' : '🎲 Jiný tah') : '✎ Upravit';
    if (document.activeElement !== $('obrSirka')) $('obrSirka').value = Math.round(v.typ === 'pecet' ? d.pecetVel : o.w);
    $('obrRot').value = v.typ === 'pecet' ? 0 : o.rot; $('obrRot').disabled = v.typ === 'pecet';
    if (o) { $('obrOp').value = Math.round(o.op * 100); $('obrBlend').value = o.blend; $('obrVrstva').textContent = o.vrstva === 'za' ? '⬆' : '⬇'; $('obrVrstva').title = o.vrstva === 'za' ? 'Za textem – přesunout před text' : 'Před textem – přesunout za text'; }
  }
  function prvekEl() { return vybrany && document.querySelector(vybrany.typ === 'pecet' ? '#hlavniList [data-prvek="pecet"]' : `#hlavniList [data-prvek="obr"][data-i="${vybrany.i}"]`); }
  /* Změna vlastnosti bez překreslení celého listu (rychlé při tažení posuvníků). */
  function uplatniPrvek() {
    const e = prvekEl(); if (!e) return;
    if (vybrany.typ === 'pecet') { const p = polohaPecete(P.FORMATY[d.format]); Object.assign(e.style, { left: p.x + 'mm', top: p.y + 'mm', width: d.pecetVel + 'mm' }); return; }
    const o = d.obrazky[vybrany.i];
    Object.assign(e.style, { left: o.x + 'mm', top: o.y + 'mm', width: o.w + 'mm', transform: `rotate(${o.rot}deg)`, opacity: o.op, mixBlendMode: o.blend });
    e.classList.toggle('za', o.vrstva === 'za');
  }
  let tahPrvku = null;
  $('listy').addEventListener('pointerdown', e => {
    if (!upravy()) return;
    if (e.target.closest && e.target.closest('.pozn-text[contenteditable]')) return;   // psaní do poznámky
    const vt = e.target.closest && e.target.closest('#telo img[data-obr]');
    if (e.button === 2) {   // pravé tlačítko: jen vybrat (nabídku otevře contextmenu), nic netáhnout
      const pr = e.target.closest('#hlavniList .prvek');
      if (vt) vyberPrvek({ typ: 'txt', el: vt });
      else if (pr) vyberPrvek(pr.dataset.prvek === 'pecet' ? { typ: 'pecet' } : { typ: 'obr', i: +pr.dataset.i });
      else if (vybrany) vyberPrvek(null);
      return;
    }
    if (vt) {
      e.preventDefault(); vyberPrvek({ typ: 'txt', el: vt });
      if (e.button === 0) { tahTextu = { el: vt, x0: e.clientX, y0: e.clientY, pohyb: false, kam: null }; try { $('listy').setPointerCapture(e.pointerId); } catch (x) { /* syntetická */ } }
      return;
    }
    let el = e.target.closest('#hlavniList .prvek');
    if (!el && e.altKey) el = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('prvek'));   // Alt+klik: obrázek za textem
    if (!el) { if (vybrany && !e.target.closest('.uchyt')) vyberPrvek(null); return; }
    e.preventDefault();
    const typ = el.dataset.prvek, i = +el.dataset.i;
    vyberPrvek(typ === 'pecet' ? { typ } : { typ, i });
    const F = P.FORMATY[d.format], pc = polohaPecete(F);
    const o = typ === 'pecet' ? { x: pc.x, y: pc.y, w: d.pecetVel } : d.obrazky[i];
    tahPrvku = { x0: e.clientX, y0: e.clientY, x: o.x, y: o.y, w: o.w, velikost: !!e.target.closest('[data-uchyt]') };
    try { $('listy').setPointerCapture(e.pointerId); } catch (x) { /* syntetická událost */ }
  });
  /* Obrázek v textu se přesouvá tažením: kurzor vkládání ukazuje, kam se vloží. */
  let tahTextu = null;
  const kurzor = document.createElement('div'); kurzor.className = 'kurzor-vkladani'; kurzor.hidden = true; document.body.appendChild(kurzor);
  function kurzorZBodu(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    const p = document.caretPositionFromPoint && document.caretPositionFromPoint(x, y);
    if (!p) return null;
    const r = document.createRange(); r.setStart(p.offsetNode, p.offset); return r;
  }
  $('listy').addEventListener('pointermove', e => {
    if (!tahTextu) return;
    const t = tahTextu;
    if (!t.pohyb && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < 5) return;
    t.pohyb = true; t.el.style.opacity = '.35'; t.el.style.pointerEvents = 'none';
    const r = kurzorZBodu(e.clientX, e.clientY), tl = telo();
    t.kam = r && tl.contains(r.startContainer) && !t.el.contains(r.startContainer) ? r : null;
    if (!t.kam) { kurzor.hidden = true; return; }
    const ob = (t.kam.getClientRects()[0] || t.kam.getBoundingClientRect());
    const vys = Math.max(ob.height, 14 * meritko);
    Object.assign(kurzor.style, { left: ob.left - 1 + 'px', top: ob.top + 'px', height: vys + 'px' }); kurzor.hidden = false;
  });
  const konecTahuTextu = () => {
    if (!tahTextu) return;
    const t = tahTextu; tahTextu = null; kurzor.hidden = true;
    t.el.style.opacity = ''; t.el.style.pointerEvents = '';
    if (t.pohyb && t.kam) { t.kam.insertNode(t.el); ulozText(); vyberPrvek({ typ: 'txt', el: t.el }); zprava('Obrázek přesunut v textu.'); }
  };
  $('listy').addEventListener('pointerup', konecTahuTextu); $('listy').addEventListener('pointercancel', konecTahuTextu);
  $('listy').addEventListener('pointermove', e => {
    if (!tahPrvku) return;
    const k = meritko * PX_MM, dx = (e.clientX - tahPrvku.x0) / k, dy = (e.clientY - tahPrvku.y0) / k;
    const zaokr = v => Math.round(v * 2) / 2;
    if (vybrany.typ === 'pecet') {
      if (tahPrvku.velikost) d.pecetVel = Math.max(10, Math.min(60, zaokr(tahPrvku.w + dx)));
      else { const p = prichyt(zaokr(tahPrvku.x + dx), zaokr(tahPrvku.y + dy), d.pecetVel, d.pecetVel, e.altKey); d.pecetX = p.x; d.pecetY = p.y; }
    } else {
      const o = d.obrazky[vybrany.i], el = prvekEl();
      if (tahPrvku.velikost) o.w = Math.max(3, zaokr(tahPrvku.w + dx));
      else { const h = el ? el.offsetHeight / PX_MM : o.w; const p = prichyt(zaokr(tahPrvku.x + dx), zaokr(tahPrvku.y + dy), o.w, h, e.altKey); o.x = p.x; o.y = p.y; }
    }
    uplatniPrvek(); stavPrvku();
  });
  /* Přichytávání k ose listu a k okrajům textu (do 2 mm), s vodicími čarami. Alt přichytávání vypne. */
  function prichyt(x, y, w, h, vypnout) {
    const L = $('hlavniList'); L.querySelectorAll('.voditko').forEach(v => v.remove());
    if (vypnout) return { x, y };
    const F = P.FORMATY[d.format], tol = 2, cary = [];
    const svisle = [F.w / 2, d.okrajBoky, F.w - d.okrajBoky], vodorovne = [F.h / 2, d.okrajNahore, F.h - d.okrajDole];
    const zkus = (hodnota, body, cil) => { for (const [b, posun] of body) for (const c of cil) if (Math.abs(b - c) < tol) return { v: hodnota + c - b, cara: c }; return null; };
    const sx = zkus(x, [[x + w / 2, 0], [x, 0], [x + w, 0]], svisle), sy = zkus(y, [[y + h / 2, 0], [y, 0], [y + h, 0]], vodorovne);
    if (sx) { x = Math.round(sx.v * 2) / 2; cary.push(`<div class="voditko svisle" style="left:${sx.cara}mm"></div>`); }
    if (sy) { y = Math.round(sy.v * 2) / 2; cary.push(`<div class="voditko vodorovne" style="top:${sy.cara}mm"></div>`); }
    if (cary.length) L.insertAdjacentHTML('beforeend', cary.join(''));
    return { x, y };
  }
  const konecTahuPrvku = () => { if (tahPrvku) { tahPrvku = null; document.querySelectorAll('#hlavniList .voditko').forEach(v => v.remove()); uloz(); nastavPole(); } };
  $('listy').addEventListener('pointerup', konecTahuPrvku); $('listy').addEventListener('pointercancel', konecTahuPrvku);
  // vlastnosti vybraného prvku v pásu
  $('obrSirka').addEventListener('input', e => {
    if (vybrany && vybrany.typ === 'txt') { const w = Math.max(5, Math.min(100, +e.target.value || 40)); vybrany.el.dataset.sirka = w; vybrany.el.style.width = w + '%'; ulozText(); return; }
    const v = Math.max(3, +e.target.value || 3); if (vybrany.typ === 'pecet') d.pecetVel = Math.min(60, v); else d.obrazky[vybrany.i].w = v; uplatniPrvek(); uloz(); });
  $('obrRot').addEventListener('input', e => { if (vybrany.typ === 'obr') { d.obrazky[vybrany.i].rot = +e.target.value; uplatniPrvek(); uloz(); } });
  $('obrOp').addEventListener('input', e => { if (vybrany.typ === 'obr') { d.obrazky[vybrany.i].op = +e.target.value / 100; uplatniPrvek(); uloz(); } });
  $('obrBlend').addEventListener('change', e => { if (vybrany.typ === 'obr') { d.obrazky[vybrany.i].blend = e.target.value; uplatniPrvek(); uloz(); } });
  $('pasObrazek').addEventListener('click', async e => {
    const b = e.target.closest('[data-prvek]'); if (!b || !vybrany) return;
    const a = b.dataset.prvek;
    if (a === 'smazat') return smazPrvek();
    if (vybrany.typ === 'txt' && a === 'upravit') {
      const el = vybrany.el, z = obrazky[el.dataset.obr]; if (!z) return;
      const v = await PERGAMEN_OBRAZEK.uprav(z.orig, z.nastaveni);
      if (!v) return;
      await ulozObrazek(Object.assign({}, z, { vysledek: v.src, nastaveni: v.nastaveni }));
      el.src = v.src; ulozText(); return;
    }
    if (vybrany.typ !== 'obr') return;
    const o = d.obrazky[vybrany.i];
    if (a === 'upravit' && o.kresba) {   // poznámka = psát do ní, kresba = nový tah perem
      if (o.kresba === 'poznamka') return zacniPsatPoznamku(vybrany.i);
      o.seed = nahodne(); uloz(); return vykresli();
    }
    if (a === 'vrstva') { o.vrstva = o.vrstva === 'za' ? 'pred' : 'za'; uplatniPrvek(); stavPrvku(); uloz(); zprava(o.vrstva === 'za' ? 'Obrázek je za textem – vyberete ho Alt+klikem.' : 'Obrázek je před textem.'); }
    if (a === 'kopie') { d.obrazky.push(Object.assign({}, o, { x: o.x + 6, y: o.y + 6 })); vybrany = { typ: 'obr', i: d.obrazky.length - 1 }; uloz(); vykresli(); }
    if (a === 'upravit') {
      const z = obrazky[o.id];
      const v = await PERGAMEN_OBRAZEK.uprav(z.orig, z.nastaveni);
      if (!v) return;
      await ulozObrazek(Object.assign({}, z, { vysledek: v.src, nastaveni: v.nastaveni }));
      o.w = Math.max(3, o.w);
      uloz(); vykresli();
    }
  });
  function smazPrvek() {
    if (!vybrany) return;
    if (vybrany.typ === 'txt') { vybrany.el.remove(); vybrany = null; ulozText(); stavPrvku(); return; }
    if (vybrany.typ === 'pecet') d.pecet = false; else d.obrazky.splice(vybrany.i, 1);
    vybrany = null; uloz(); vse();
  }
  document.addEventListener('keydown', e => {
    if (!vybrany || !upravy() || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.closest('.pozn-text') || document.querySelector('.po-zavoj, dialog[open]')) return;
    if (document.activeElement.isContentEditable && getSelection().rangeCount && !getSelection().isCollapsed) return;   // označený text má přednost
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); smazPrvek(); }
    const sipky = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (sipky) {
      e.preventDefault(); const k = e.shiftKey ? 5 : 0.5;
      if (vybrany.typ === 'txt') return;
      if (vybrany.typ === 'pecet') { const p = polohaPecete(P.FORMATY[d.format]); d.pecetX = p.x + sipky[0] * k; d.pecetY = p.y + sipky[1] * k; }
      else { const o = d.obrazky[vybrany.i]; o.x += sipky[0] * k; o.y += sipky[1] * k; }
      uplatniPrvek(); uloz();
    }
  });
  // dvojklik na vložený obrázek (volný i v textu) znovu otevře editor obrázku
  $('listy').addEventListener('dblclick', e => {
    if (!upravy()) return;
    const vt = e.target.closest('#telo img[data-obr]'), pr = e.target.closest('#hlavniList .prvek.obrazek'), kr = e.target.closest('#hlavniList .prvek.kresba');
    if (kr) { e.preventDefault(); const i = +kr.dataset.i; vyberPrvek({ typ: 'obr', i }); if (d.obrazky[i].kresba === 'poznamka') zacniPsatPoznamku(i); return; }
    if (vt) { e.preventDefault(); vyberPrvek({ typ: 'txt', el: vt }); }
    else if (pr) { e.preventDefault(); vyberPrvek({ typ: 'obr', i: +pr.dataset.i }); }
    else return;
    document.querySelector('#pasObrazek [data-prvek=upravit]').click();
  });

  /* ---------- kresby perem a poznámky na okraj ---------- */
  const IKONY_KRESEB = { poznamka: '📝', sipka: '→', sipkaOblouk: '↷', krouzek: '◯', vlnovka: '〰', zavorka: '{', krizek: '✗', hvezda: '✶', ruka: '☞' };
  $('nabKresby').innerHTML = '<div class="titulek">Kresba perem na list</div>'
    + Object.entries(P.KRESBY).map(([k, [n]]) => `<button class="tl" data-kresba="${k}"><span style="display:inline-block;width:1.4em;text-align:center">${IKONY_KRESEB[k]}</span> ${esc(n)}</button>`).join('')
    + '<p class="pozn" style="padding:4px 10px;margin:4px 0 0">Kreslí se barvou inkoustu, „rukou“. Táhněte myší, rohem změníte velikost, v pásu otočíte. Dvojklik na poznámku = psát.</p>';
  function pridejKresbu(typ) {
    const F = P.FORMATY[d.format], pomer = P.KRESBY[typ][1];
    const w = { poznamka: 45, zavorka: 9, krizek: 16, hvezda: 14, vlnovka: 45 }[typ] || 32, h = pomer ? w * pomer : 12;
    d.obrazky.push({ kresba: typ, seed: nahodne(), text: typ === 'poznamka' ? 'Pozor!' : '', vel: 11, x: Math.round((F.w - w) / 2), y: Math.round((F.h - h) / 2), w, rot: typ === 'poznamka' ? -4 : 0, op: 1, blend: 'multiply', vrstva: 'pred' });
    pohled = 'text'; vybrany = { typ: 'obr', i: d.obrazky.length - 1 };
    uloz(); vykresli();
    if (typ === 'poznamka') zacniPsatPoznamku(d.obrazky.length - 1);
    else zprava('Kresba je uprostřed listu – přetáhněte ji, kam patří.');
  }
  function zacniPsatPoznamku(i) {
    const el = document.querySelector(`#hlavniList [data-prvek="obr"][data-i="${i}"] .pozn-text`); if (!el) return;
    el.setAttribute('contenteditable', 'plaintext-only'); if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') el.blur(); });
    el.addEventListener('blur', () => { const o = d.obrazky[i]; if (o) o.text = el.innerText.replace(/\n+$/, '').slice(0, 500); el.removeAttribute('contenteditable'); uloz(); vykresli(); }, { once: true });
  }

  /* ---------- umístění obrázku: volně na listu ↔ v textu ---------- */
  const sirkaTextuMm = () => (telo() ? telo().clientWidth / PX_MM : 120);
  function uvolniZTextu(img) {   // obrázek z textu na list – zůstane, kde je
    const L = $('hlavniList').getBoundingClientRect(), r = img.getBoundingClientRect(), k = meritko * PX_MM;
    d.obrazky.push({ id: img.dataset.obr, x: Math.round((r.left - L.left) / k), y: Math.round((r.top - L.top) / k), w: Math.max(3, Math.round(r.width / k)), rot: 0, op: 1, blend: 'multiply', vrstva: 'pred' });
    img.remove(); ulozText();
    vybrany = { typ: 'obr', i: d.obrazky.length - 1 }; vykresli(); zprava('Obrázek je volně na listu – táhněte ho myší.');
  }
  function vlozDoTextu(i, obtekani) {   // volný obrázek do textu – na místo textu pod jeho levým horním rohem
    const o = d.obrazky[i], el = document.querySelector(`#hlavniList [data-prvek="obr"][data-i="${i}"]`), tl = telo();
    if (!o || !tl) return;
    let r = null;
    if (el) { const rr = el.getBoundingClientRect(); el.style.pointerEvents = 'none'; r = kurzorZBodu(rr.left + 4, rr.top + 4); el.style.pointerEvents = ''; }
    if (!r || !tl.contains(r.startContainer)) { r = document.createRange(); const p = tl.querySelector('p') || tl; r.setStart(p, 0); }
    const img = document.createElement('img');
    Object.assign(img.dataset, { obr: o.id, obtekani, sirka: String(Math.max(5, Math.min(100, Math.round(o.w / sirkaTextuMm() * 100)))) });
    r.collapse(true); r.insertNode(img);
    d.obrazky.splice(i, 1); ulozText(); vybrany = null; vykresli();
    const nove = document.querySelector(`#telo img[data-obr="${o.id}"]`); if (nove) vyberPrvek({ typ: 'txt', el: nove });
    zprava('Obrázek je v textu – přetažením ho přesunete jinam.');
  }
  // položky „Umístění“ v pásu
  $('obrUmisteni').addEventListener('change', e => {
    const v = e.target.value; if (!vybrany) return;
    if (vybrany.typ === 'txt') { if (v === 'volne') uvolniZTextu(vybrany.el); else { vybrany.el.dataset.obtekani = v; ulozText(); } }
    else if (vybrany.typ === 'obr' && v !== 'volne') vlozDoTextu(vybrany.i, v);
  });

  /* ---------- kontextová nabídka (pravé tlačítko) v celém náhledu ----------
     Prohlížečová nabídka je v náhledu vypnutá; obsah se řídí místem kliknutí:
     obrázek / pečeť, text (formát, schránka), prázdný list a okolí (list, vložit, náhled, výstup). */
  const kontext = document.createElement('div'); kontext.className = 'nabidka kontext'; kontext.hidden = true; kontext.setAttribute('role', 'menu'); document.body.appendChild(kontext);
  const zavriKontext = () => { kontext.hidden = true; };
  let kontextTyp = null, kontextList = null;
  function polozky(typ) {
    const p = [];
    const t = (k, txt, zap, klav) => p.push(`<button class="tl" role="menuitem" data-k="${k}"${zap === false ? ' disabled' : ''}>${txt}${klav ? ` <kbd>${klav}</kbd>` : ''}</button>`);
    const hr = () => p.push('<hr>'), nad = txt => p.push(`<div class="titulek">${txt}</div>`);
    const v = vybrany;
    if (typ === 'prvek' && v.typ === 'pecet') {
      t('pecetMenu', '🔏 Vlastnosti pečeti…'); t('jinyVosk', '🎲 Jiný tvar vosku'); t('pecetObrazek', d.pecetObr ? '🖼️ Jiný obrázek do vosku…' : '🖼️ Obrázek do vosku…'); t('pecetZpet', '↺ Vrátit na výchozí místo'); t('stredH', '↔ Na střed listu'); hr(); t('smazat', '🗑️ Odstranit pečeť', true, 'Delete');
    } else if (typ === 'prvek' && v.typ === 'obr' && d.obrazky[v.i].kresba) {
      const o = d.obrazky[v.i];
      if (o.kresba === 'poznamka') { t('upravit', '✎ Přepsat text', true, 'dvojklik'); p.push('<div class="kontext-rad"><button class="tl" data-k="mensiPozn" title="Menší písmo">A−</button><button class="tl" data-k="vetsiPozn" title="Větší písmo">A+</button></div>'); }
      else t('upravit', '🎲 Jiný tah perem');
      hr(); t('vrstva', o.vrstva === 'za' ? '⬆ Před text' : '⬇ Za text');
      t('otoc', '⟳ Otočit o 90°'); t('rovne', '⊾ Narovnat', !!o.rot); t('stredH', '↔ Na střed listu'); t('kopie', '⎘ Kopie');
      hr(); t('smazat', '🗑️ Odstranit', true, 'Delete');
    } else if (typ === 'prvek') {
      const txt = v.typ === 'txt', o = !txt && d.obrazky[v.i], ob = txt && v.el.dataset.obtekani;
      t('upravit', '✎ Upravit obrázek…', true, 'dvojklik'); hr();
      nad('Umístění');
      t('volne', (txt ? '' : '✓ ') + 'Volně na listu');
      t('left', (ob === 'left' ? '✓ ' : '') + 'V textu vlevo, text obtéká');
      t('right', (ob === 'right' ? '✓ ' : '') + 'V textu vpravo, text obtéká');
      t('center', (ob === 'center' ? '✓ ' : '') + 'V textu na střed');
      hr();
      if (!txt) {
        t('vrstva', o.vrstva === 'za' ? '⬆ Před text' : '⬇ Za text');
        t('otoc', '⟳ Otočit o 90°'); t('rovne', '⊾ Narovnat', !!o.rot); t('stredH', '↔ Na střed listu');
        t('kopie', '⎘ Kopie obrázku');
      } else { t('vetsi', '+ Větší'); t('mensi', '− Menší'); }
      hr(); t('smazat', '🗑️ Odstranit', true, 'Delete');
    } else if (typ === 'text') {
      const sel = getSelection(), oznaceno = sel.rangeCount && !sel.isCollapsed;
      t('vyjmout', '✂ Vyjmout', !!oznaceno, 'Ctrl+X'); t('kopirovat', '⧉ Kopírovat', !!oznaceno, 'Ctrl+C'); t('vlozit', '📋 Vložit ze schránky', true, 'Ctrl+V'); t('vybratVse', '▭ Vybrat vše', true, 'Ctrl+A');
      hr(); nad(oznaceno ? 'Označený text' : 'Psaní od kurzoru');
      p.push('<div class="kontext-rad">'
        + `<button class="tl ik" data-k="bold" title="Tučně"><b>B</b></button><button class="tl ik" data-k="italic" title="Kurzíva"><i>I</i></button>`
        + `<button class="tl ik" data-k="underline" title="Podtržení"><u>U</u></button><button class="tl ik" data-k="strikeThrough" title="Přeškrtnutí"><s>S</s></button>`
        + `<button class="tl ik" data-k="mensiPismo" title="Menší písmo">A−</button><button class="tl ik" data-k="vetsiPismo" title="Větší písmo">A+</button></div>`);
      p.push('<div class="kontext-rad">' + Object.entries(P.INKOUSTY).concat([['#8a2414', 'Rumělka (rubrika)']]).map(([b, n]) => `<button class="tl ik barva" data-k="barva" data-b="${b}" title="${esc(n)}" aria-label="${esc(n)}" style="background:${b}"></button>`).join('') + '</div>');
      t('pismo', '🔤 Písmo…'); t('vymazat', '⌫ Vymazat formát');
      if (oznaceno) {
        hr(); nad('Opravy rukou');
        t('skrt', '✗ Škrtnout rukou'); t('zacernit', '▓ Začernit'); t('oprava', '✎ Opravit – připsat nad…');
      }
      if (opravaPodKurzorem()) { if (!oznaceno) hr(); t('zrusitOpravu', '↺ Zrušit škrt a opravu'); }
      if (jeTelo(aktivni)) {
        hr(); nad('Odstavec');
        p.push('<div class="kontext-rad">'
          + `<button class="tl ik" data-k="justifyLeft" title="Vlevo">⯇</button><button class="tl ik" data-k="justifyCenter" title="Na střed">≡</button><button class="tl ik" data-k="justifyRight" title="Vpravo">⯈</button><button class="tl ik" data-k="justifyFull" title="Do bloku">☰</button></div>`);
        t('blok-p', 'Normální odstavec'); t('blok-h2', 'Mezititulek'); t('blok-blockquote', 'Citát');
        if (aktivni.id === 'telo') { hr(); t('obrazekSem', '🖼️ Vložit obrázek sem…'); }
      }
    } else {   // prázdný list, okolí náhledu, zašifrovaný pohled
      if (sifrovano()) { t('pohled', pohled === 'text' ? '🔐 Ukázat šifru' : '✍️ Upravit text'); hr(); }
      if (upravy()) { t('obrazekVolne', '🖼️ Vložit obrázek…'); t('menu:nabKresby', '✒️ Kresba perem…'); t('pecetPrepni', d.pecet ? '🔏 Odebrat pečeť' : '🔏 Přidat pečeť'); hr(); }
      if (upravy() && kontextList && kontextList !== 'hlavni') { t('odebratList', '🗑 Odebrat tento list'); hr(); }
      nad('List');
      t('menu:nabPapir', '📄 Papír, okraj a rámeček…'); t('menu:nabPoskozeni', '💥 Poničení…'); t('menu:nabPismo', '🔤 Výchozí písmo…'); t('menu:nabSifra', '🔐 Šifra a klíč…'); t('menu:nabListy', '📑 Listy, rub, obálka…'); t('jinyPapir', '🎲 Jiné natržení a skvrny');
      hr(); nad('Náhled');
      p.push('<div class="kontext-rad">'
        + `<button class="tl" data-k="zoomMinus" title="Oddálit">−</button><button class="tl" data-k="zoom100" title="Skutečná velikost">100 %</button><button class="tl" data-k="zoomPlus" title="Přiblížit">+</button>`
        + `<button class="tl" data-k="zoomSirka" title="Na šířku">↔</button><button class="tl" data-k="zoomStranka" title="Celý list">▣</button></div>`);
      hr(); t('tisk', '🖨️ Tisk…', true, 'Ctrl+P'); t('png', '⬇ Stáhnout PNG'); t('pdf', '⬇ Stáhnout PDF'); t('kopirovatObrazek', '📋 Kopírovat list jako obrázek');
      hr(); t('zpetDokument', '↶ Zpět', historie.length > 1, 'Ctrl+Z'); t('znovuDokument', '↷ Znovu', vpred.length > 0, 'Ctrl+Y');
    }
    return p.join('');
  }
  $('nahled').addEventListener('contextmenu', e => {
    e.preventDefault();   // v celém náhledu jen vlastní nabídka
    if (exportuje) return;
    const vt = e.target.closest('#telo img[data-obr]'), pr = e.target.closest('#hlavniList .prvek');
    const ed = upravy() && e.target.closest(EDITORY);
    if (upravy() && (vt || pr)) {
      if (vt) vyberPrvek({ typ: 'txt', el: vt });
      else vyberPrvek(pr.dataset.prvek === 'pecet' ? { typ: 'pecet' } : { typ: 'obr', i: +pr.dataset.i });
      kontextTyp = 'prvek';
    } else if (ed) {
      if (vybrany) vyberPrvek(null);
      // klik mimo označení přesune kurzor (jako v textovém editoru), klik do označení ho nechá
      const sel = getSelection();
      const vOznaceni = sel.rangeCount && !sel.isCollapsed && [...sel.getRangeAt(0).getClientRects()].some(r => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
      if (!vOznaceni) { const r = kurzorZBodu(e.clientX, e.clientY); if (r && ed.contains(r.startContainer)) { ed.focus(); sel.removeAllRanges(); sel.addRange(r); } }
      aktivni = ed; ulozRozsah();
      kontextTyp = 'text';
    } else kontextTyp = 'list';
    const kl = e.target.closest('.list'); kontextList = kl ? kl.dataset.list || 'hlavni' : null;
    zavriNabidky();
    kontext.innerHTML = polozky(kontextTyp); kontext.hidden = false;
    const w = kontext.offsetWidth, h = kontext.offsetHeight;
    kontext.style.left = Math.max(6, Math.min(e.clientX, innerWidth - w - 6)) + 'px';
    kontext.style.top = Math.max(6, Math.min(e.clientY, innerHeight - h - 6)) + 'px';
    if (kontextTyp !== 'text') { const prvni = kontext.querySelector('button:not(:disabled)'); if (prvni) prvni.focus(); }   // u textu zůstane fokus (a výběr) v listu
  });
  kontext.addEventListener('mousedown', e => e.preventDefault());   // tlačítko nesmí vzít fokus z textu
  kontext.addEventListener('click', async e => {
    const b = e.target.closest('[data-k]'); if (!b || b.disabled) return;
    const k = b.dataset.k; zavriKontext();
    if (kontextTyp === 'text') return akceTextu(k, b);
    if (kontextTyp === 'list') return akceListu(k);
    const v = vybrany; if (!v) return;
    const tlacitko = a => document.querySelector(`#pasObrazek [data-prvek="${a}"]`).click();
    const F = P.FORMATY[d.format];
    switch (k) {
      case 'upravit': case 'kopie': case 'vrstva': return tlacitko(k);
      case 'smazat': return smazPrvek();
      case 'pecetZpet': case 'jinyVosk': case 'pecetObrazek': return PRIKAZY[k]();
      case 'vetsiPozn': case 'mensiPozn': { const o = d.obrazky[v.i]; o.vel = Math.max(5, Math.min(40, o.vel + (k === 'vetsiPozn' ? 1 : -1))); uloz(); return vykresli(); }
      case 'pecetMenu': return document.querySelector('[data-nabidka="nabPecet"]').click();
      case 'volne': if (v.typ === 'txt') uvolniZTextu(v.el); return;
      case 'left': case 'right': case 'center':
        if (v.typ === 'obr') return vlozDoTextu(v.i, k);
        v.el.dataset.obtekani = k; ulozText(); return stavPrvku();
      case 'vetsi': case 'mensi': { const w = Math.max(5, Math.min(100, (+v.el.dataset.sirka || 40) + (k === 'vetsi' ? 10 : -10))); v.el.dataset.sirka = w; v.el.style.width = w + '%'; ulozText(); return stavPrvku(); }
      case 'otoc': d.obrazky[v.i].rot = ((d.obrazky[v.i].rot + 90 + 180) % 360) - 180; break;
      case 'rovne': d.obrazky[v.i].rot = 0; break;
      case 'stredH':
        if (v.typ === 'pecet') { const p = polohaPecete(F); d.pecetX = Math.round((F.w - d.pecetVel) / 2); d.pecetY = p.y; }
        else d.obrazky[v.i].x = Math.round((F.w - d.obrazky[v.i].w) / 2);
        break;
    }
    uplatniPrvek(); stavPrvku(); uloz();
  });
  /* Ruční oprava: označený text (v jednom odstavci) zabalit do spanu se škrtem, začerněním nebo opravou. */
  function obalVyber(fn) {
    if (!upravy() || !obnovVyber()) return;
    const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return zprava('Nejdřív označte text.');
    const r = sel.getRangeAt(0);
    if (r.cloneContents().querySelector('p,h2,blockquote')) return zprava('Označte text v jednom odstavci.');
    const sp = document.createElement('span'); fn(sp);
    sp.appendChild(r.extractContents()); r.insertNode(sp);
    sel.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(sp); sel.addRange(nr);
    ulozEditor(aktivni);
  }
  function opravaPodKurzorem() {
    const sel = getSelection(); if (!sel.rangeCount) return null;
    const n = sel.anchorNode, e = n && (n.nodeType === 3 ? n.parentElement : n);
    const sp = e && e.closest && e.closest('span.skrt, span.zacerneni, span[data-oprava]');
    return sp && editorUzlu(sp) ? sp : null;
  }
  async function akceTextu(k, b) {
    const pas = f => document.querySelector(`#pas [data-format="${f}"]`).click();
    switch (k) {
      case 'vyjmout': case 'kopirovat': obnovVyber(); document.execCommand(k === 'vyjmout' ? 'cut' : 'copy'); if (k === 'vyjmout') ulozEditor(aktivni); return;
      case 'vlozit':
        try { const t = await navigator.clipboard.readText(); obnovVyber(); document.execCommand('insertText', false, t); ulozEditor(aktivni); }
        catch (x) { zprava('Prohlížeč nedovolil číst schránku – vložte pomocí Ctrl+V.'); }
        return;
      case 'vybratVse': { obnovVyber(); const r = document.createRange(); r.selectNodeContents(aktivni); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
      case 'bold': case 'italic': case 'underline': case 'strikeThrough': case 'vymazat':
      case 'justifyLeft': case 'justifyCenter': case 'justifyRight': case 'justifyFull': return pas(k);
      case 'barva': return formatuj(() => document.execCommand('foreColor', false, b.dataset.b));
      case 'vetsiPismo': case 'mensiPismo': {
        const nyni = +$('pasVelikost').value || d.velikost;
        const nove = k === 'vetsiPismo' ? (VELIKOSTI.find(x => x > nyni) || nyni + 6) : ([...VELIKOSTI].reverse().find(x => x < nyni) || Math.max(6, nyni - 1));
        nastavVelikostPasu(nove); $('pasVelikost').dispatchEvent(new Event('change')); return;
      }
      case 'pismo': return document.querySelector('#pasPismo .fv-tlacitko').click();
      case 'blok-p': case 'blok-h2': case 'blok-blockquote': return formatuj(ed => { if (jeTelo(ed)) document.execCommand('formatBlock', false, k.slice(5)); });
      case 'obrazekSem': return PRIKAZY.vlozObrazek();
      case 'skrt': return obalVyber(sp => { sp.className = 'skrt'; });
      case 'zacernit': return obalVyber(sp => { sp.className = 'zacerneni'; });
      case 'oprava': {
        const r = rozsah && rozsah.cloneRange();
        const t = await Dialog.zeptej('Oprava – co připsat nad škrtnutý text:', '');
        if (t == null) return;
        rozsah = r; return obalVyber(sp => { sp.className = 'skrt'; sp.dataset.oprava = t.trim(); });
      }
      case 'zrusitOpravu': { const sp = opravaPodKurzorem(); if (sp) { const ed = editorUzlu(sp); sp.replaceWith(...sp.childNodes); ulozEditor(ed); } return; }
    }
  }
  function akceListu(k) {
    if (k.startsWith('menu:')) { const tl = document.querySelector(`[data-nabidka="${k.slice(5)}"]`); if (tl) tl.click(); return; }
    switch (k) {
      case 'pohled': return $('pasPohled').click();
      case 'obrazekVolne': rozsah = null; return PRIKAZY.vlozObrazek();
      case 'pecetPrepni': d.pecet = !d.pecet; if (d.pecet) d.pecetSeed = nahodne(); uloz(); return vse();
      case 'odebratList': return odeberList(kontextList);
      default: if (PRIKAZY[k]) return PRIKAZY[k]();
    }
  }
  kontext.addEventListener('keydown', e => {
    const b = [...kontext.querySelectorAll('button:not(:disabled)')], i = b.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); zavriKontext(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); b[(i + (e.key === 'ArrowDown' ? 1 : b.length - 1)) % b.length].focus(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !kontext.hidden) zavriKontext(); });
  document.addEventListener('pointerdown', e => { if (!kontext.hidden && !kontext.contains(e.target)) zavriKontext(); }, true);
  addEventListener('blur', zavriKontext); $('nahled').addEventListener('scroll', zavriKontext);

  /* Vložení obrázku: načíst → editor → do IndexedDB → na list doprostřed. */
  async function vlozObrazek(file) {
    try {
      const orig = await PERGAMEN_OBRAZEK.nacti(file);
      const kurzor = rozsah && telo() && telo().contains(rozsah.commonAncestorContainer) ? rozsah.cloneRange() : null;
      const v = await PERGAMEN_OBRAZEK.uprav(orig, { inkoust: d.inkoust }, { umisteni: true, vychoziUmisteni: kurzor ? 'text-left' : 'volne' });
      if (!v) return;
      const id = 'o' + noveId().replace(/[^a-z0-9]/gi, '');
      await ulozObrazek({ id, orig, vysledek: v.src, nastaveni: v.nastaveni });
      if (v.umisteni.startsWith('text-')) {   // do textu na místo kurzoru (jinak na začátek), text obtéká
        pohled = 'text'; if (!upravy()) vykresli();
        const t = telo(), img = document.createElement('img');
        Object.assign(img.dataset, { obr: id, obtekani: v.umisteni.slice(5), sirka: '40' });
        img.src = v.src; img.style.width = '40%'; img.draggable = false;
        let r = kurzor && t.contains(kurzor.commonAncestorContainer) ? kurzor : null;
        if (!r) { r = document.createRange(); const p = t.querySelector('p') || t; r.setStart(p, 0); }
        r.collapse(true); r.insertNode(img);
        ulozText(); vyberPrvek({ typ: 'txt', el: img }); zprava('Obrázek vložen do textu – obtékání a šířku nastavíte v pásu.');
        return;
      }
      const F = P.FORMATY[d.format], w = Math.min(F.w * 0.45, 80), h = w * v.h / v.w;
      d.obrazky.push({ id, x: Math.round((F.w - w) / 2), y: Math.round((F.h - h) / 2), w: Math.round(w), rot: 0, op: 1, blend: 'multiply', vrstva: 'pred' });
      pohled = 'text'; vybrany = { typ: 'obr', i: d.obrazky.length - 1 };
      uloz(); vykresli(); zprava('Obrázek vložen – táhněte ho myší, rohem změníte velikost.');
    } catch (chyba) { Dialog.chyba(chyba.message); }
  }
  $('souborObrazku').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) vlozObrazek(f); });
  // obrázek jde i přetáhnout ze složky rovnou na náhled
  $('nahled').addEventListener('dragover', e => { if ([...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
  $('nahled').addEventListener('drop', e => { const f = [...e.dataTransfer.files].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); vlozObrazek(f); } });

  /* Největší velikost písma, při které se text vejde (půlením intervalu). */
  function prizpusob() {
    let lo = 6, hi = 40;
    for (let i = 0; i < 12; i++) {
      const m = (lo + hi) / 2; d.velikost = m; vykresli();
      const t = $('telo');
      if (t.scrollHeight > t.clientHeight + 1) hi = m; else lo = m;
    }
    d.velikost = Math.floor(lo * 2) / 2; uloz(); vse();
    zprava(`Velikost písma ${d.velikost} pt.`);
  }

  /* ---------- export ---------- */
  function nactiSkript(src, globalni) {
    if (window[globalni]) return Promise.resolve();
    return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('Knihovnu se nepodařilo načíst.')); document.head.appendChild(s); });
  }
  /* Listy jako obrázky v plném rozlišení. Prohlížeč list vykreslí sám přes SVG
     foreignObject – s vloženými písmy (data URL), takže sedí sazba i vlastní fonty
     (html2canvas písma přidaná přes FontFace v kopii dokumentu nevidí). */
  const naDataUrl = buf => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(new Blob([buf], { type: 'font/ttf' })); });
  const pismaExportu = {};
  async function fontFace(id) {
    if (!(id in pismaExportu)) {
      try {
        const rod = await FONTY.rodina(id);
        pismaExportu[id] = `@font-face{font-family:"${rod}";src:url(${await naDataUrl(await FONTY.data(id))})}`;
      } catch (e) { pismaExportu[id] = ''; }
    }
    return pismaExportu[id];
  }
  /* Pro tisk a export vždy zašifrovaná podoba bez úprav (zástupné texty prázdných polí pryč). */
  function rezimExportu(zap) { exportuje = zap; if (zap) vybrany = null; zvyrazniVyber(); vykresli(); }
  async function obrazkyListu(nasobek) {
    rezimExportu(true);
    try { return await obrazkyListu2(nasobek); } finally { rezimExportu(false); }
  }
  async function obrazkyListu2(nasobek) {
    await document.fonts.ready;
    const vText = [...document.querySelectorAll('#listy [data-font]')].map(e => e.dataset.font);
    const ids = [...new Set([d.pismo, d.pismoNadpisu, 'imfell', ...vText])].filter(Boolean);
    const pisma = typeof FONTY === 'undefined' ? [] : await Promise.all(ids.map(fontFace));
    const imfell = typeof FONTY === 'undefined' ? '' : (await fontFace('imfell')).replace(/font-family:"[^"]+"/, "font-family:'IM Fell English'");
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n') + pisma.join('') + imfell
      + '.list{filter:none !important;margin:0}';
    const out = [];
    for (const el of $('listy').querySelectorAll('.list')) {
      const wMm = parseFloat(el.style.width), hMm = parseFloat(el.style.height);
      const w = wMm * 96 / 25.4, h = hMm * 96 / 25.4;
      const html = new XMLSerializer().serializeToString(el);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">`
        + `<div xmlns="http://www.w3.org/1999/xhtml"><style>${css.replace(/]]>/g, '')}</style>${html}</div></foreignObject></svg>`;
      const img = new Image();
      await new Promise((ok, chyba) => { img.onload = ok; img.onerror = () => chyba(new Error('List se nepodařilo převést na obrázek.')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      if (img.decode) await img.decode().catch(() => {});
      const c = document.createElement('canvas');
      c.width = Math.round(w * nasobek); c.height = Math.round(h * nasobek);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      out.push({ c, w: wMm, h: hMm });
    }
    return out;
  }
  async function png() {
    zprava('Připravuji obrázek…');
    const [l] = await obrazkyListu(300 / 96);
    const b = await new Promise(ok => l.c.toBlob(ok, 'image/png'));
    if (!b) throw new Error('Prohlížeč obrázek nevytvořil.');
    stahni(b, souborNazev() + '.png');
  }
  async function pdf() {
    zprava('Připravuji PDF…');
    await nactiSkript('lib/jspdf.umd.min.js', 'jspdf');
    const listy = await obrazkyListu(200 / 96);
    const { jsPDF } = window.jspdf;
    let doc = null;
    for (const l of listy) {
      const orient = l.w > l.h ? 'landscape' : 'portrait';
      if (!doc) doc = new jsPDF({ unit: 'mm', format: [l.w, l.h], orientation: orient });
      else doc.addPage([l.w, l.h], orient);
      doc.addImage(l.c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, l.w, l.h);
    }
    stahni(doc.output('blob'), souborNazev() + '.pdf');
  }

  /* ---------- dokumenty ---------- */
  function seznam() {
    $('seznamDokumentu').innerHTML = Object.values(data.dokumenty).sort((a, b) => b.zmeneno - a.zmeneno)
      .map(x => `<button class="tl" data-otevri="${esc(x.id)}">${x.id === d.id ? '✓ ' : ''}${esc(x.nadpis || '(bez nadpisu)')}</button>`).join('');
  }
  function otevri(id) { d = data.dokumenty[id]; data.aktivni = id; uloz(); obnovVybery(); vse(); novaHistorie(); }
  async function nactiSoubor() {
    const i = $('soubor'); i.value = '';
    const f = await new Promise(ok => { i.onchange = () => ok(i.files[0] || null); i.click(); });
    if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      if (!x || (typeof x.text !== 'string' && typeof x.html !== 'string')) throw new Error('V souboru není pergamen.');
      // všechno HTML ze souboru projde čištěním (cizí soubor by jinak mohl spustit skript)
      if (typeof x.html === 'string') x.html = cisty(x.html);
      for (const k of ['nadpisHtml', 'podpisHtml', 'datumHtml']) if (typeof x[k] === 'string') x[k] = cisty(x[k], true);
      for (const l of [...(Array.isArray(x.dalsi) ? x.dalsi : []), x.rub, x.obalka]) if (l && typeof l === 'object' && typeof l.html === 'string') l.html = cisty(l.html);
      const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
      for (const z of Object.values(x.obrazkyData || {})) if (z && typeof z.id === 'string' && /^o[a-z0-9]+$/i.test(z.id) && PNG.test(z.vysledek || '') && PNG.test(z.orig || '')) await ulozObrazek({ id: z.id, orig: z.orig, vysledek: z.vysledek, nastaveni: z.nastaveni && typeof z.nastaveni === 'object' ? z.nastaveni : {} });
      delete x.obrazkyData;
      const n = P.normalizuj(x); n.id = noveId(); n.zmeneno = Date.now();
      data.dokumenty[n.id] = n; otevri(n.id); zprava('Pergamen načten.');
    } catch (e) { Dialog.chyba('Soubor nejde načíst: ' + e.message); }
  }
  const PRIKAZY = {
    novy: () => { d = novy(null); d.nadpis = 'Nový pergamen'; pohled = 'text'; uloz(); obnovVybery(); vse(); novaHistorie(); setTimeout(() => telo() && telo().focus(), 0); },
    kopie: () => { const n = P.normalizuj(JSON.parse(JSON.stringify(d))); n.id = noveId(); n.nadpis += ' (kopie)'; if (typeof n.nadpisHtml === 'string') n.nadpisHtml += ' (kopie)'; n.zmeneno = Date.now(); data.dokumenty[n.id] = n; otevri(n.id); },
    ulozSoubor: () => {   // obrázky jdou do souboru s sebou, ať se dá pergamen přenést
      const obr = {}, ids = d.obrazky.map(o => o.id).filter(Boolean).concat([...d.html.matchAll(/data-obr="([^"]+)"/g)].map(m => m[1]), d.pecetObr ? [d.pecetObr] : []);
      for (const id of ids) if (obrazky[id]) obr[id] = obrazky[id];
      stahni(new Blob([JSON.stringify(Object.assign({}, d, { obrazkyData: obr }))], { type: 'application/json' }), souborNazev() + '.pergamen.json');
    },
    nactiSoubor,
    smaz: async () => {
      if (!(await Dialog.potvrd(`Smazat pergamen „${d.nadpis || 'bez nadpisu'}“?`, { ok: 'Smazat' }))) return;
      delete data.dokumenty[d.id];
      const zbyva = Object.keys(data.dokumenty);
      if (zbyva.length) otevri(zbyva[0]); else { d = novy('vyprava'); uloz(); obnovVybery(); vse(); novaHistorie(); }
    },
    tisk: () => { rezimExportu(true); document.fonts.ready.then(() => window.print()); },
    png: () => png().catch(e => Dialog.chyba('Obrázek se nepodařilo vytvořit: ' + e.message)),
    pdf: () => pdf().catch(e => Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message)),
    prizpusob,
    zoomPlus: () => krokZoomu(1), zoomMinus: () => krokZoomu(-1), zoom100: () => nastavZoom(1),
    zoomSirka: () => nastavZoom('sirka'), zoomStranka: () => nastavZoom('stranka'),
    vlozObrazek: () => $('souborObrazku').click(),
    pecetZpet: () => { d.pecetX = d.pecetY = null; uloz(); vykresli(); },
    jinePoskozeni: () => { d.seedPosk = 1 + Math.floor(Math.random() * 1e6); uloz(); vykresli(); },
    bezPoskozeni: () => { Object.assign(d, { preklad: 'zadne', zmackani: 0, kanky: 0, diry: 0, roh: 'zadny', foxing: 0, otisk: false, vybledle: 0, voda: 0, pripaleni: 0, trhliny: 0, mastnota: 0, ozehnuti: 0 }); uloz(); vse(); },
    zpetDokument, znovuDokument,
    ulozSablonu: async () => {
      const nazev = await Dialog.zeptej('Název šablony vzhledu (papír, písma, rámeček, pečeť, okraje):', P.PAPIRY[d.papir].nazev + ' · ' + (d.nadpis || 'list'));
      if (!nazev || !nazev.trim()) return;
      data.sablony.push({ nazev: nazev.trim().slice(0, 60), vzhled: P.vzhled(d) }); uloz(); zprava('Šablona uložena – najdete ji v nabídce ✨ Ukázky.');
    },
    kopirovatObrazek: async () => {
      try {
        if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('Prohlížeč neumí vložit obrázek do schránky.');
        zprava('Připravuji obrázek…');
        const [l] = await obrazkyListu(200 / 96);
        const b = await new Promise(ok => l.c.toBlob(ok, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
        zprava('List je ve schránce jako obrázek – vložte ho Ctrl+V do dokumentu nebo zprávy.');
      } catch (e) { Dialog.chyba('Do schránky se nepodařilo zkopírovat: ' + e.message); }
    },
    napoveda: () => $('dlgNapoveda').showModal(),
    jinyPapir: () => { d.seed = Math.floor(Math.random() * 1e6); uloz(); vykresli(); },
    // pečeť
    jinyVosk: () => { d.pecet = true; d.pecetSeed = nahodne(); uloz(); vse(); },
    pecetObrazek: () => $('souborPecete').click(),
    pecetObrUpravit: async () => {
      const z = d.pecetObr && obrazky[d.pecetObr]; if (!z) return;
      const v = await PERGAMEN_OBRAZEK.uprav(z.orig, z.nastaveni); if (!v) return;
      await ulozObrazek(Object.assign({}, z, { vysledek: v.src, nastaveni: v.nastaveni }));
      for (const k in reliefy) if (k.startsWith(z.id + '|')) delete reliefy[k];
      uloz(); vykresli();
    },
    pecetObrOdebrat: () => { d.pecetObr = null; uloz(); vse(); },
    // listy
    pridejList: () => {
      d.dalsi.push({ html: '<p><br></p>' }); pohled = 'text'; uloz(); vse();
      const t = document.querySelector(`[data-telo-listu="dalsi-${d.dalsi.length - 1}"]`);
      if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); }
    },
    prelit,
    prepniRub: async () => {
      if (d.rub && pismenHtml(d.rub.html) && !(await Dialog.potvrd('Odebrat rub listu i s textem?', { ok: 'Odebrat' }))) return;
      d.rub = d.rub ? null : { html: '<p><br></p>' }; pohled = 'text'; uloz(); vse();
      if (d.rub) zprava('Rub je hned pod listem – papír a poničení jsou zrcadlově, inkoust z líce jen prosvítá.');
    },
    prepniObalku: async () => {
      if (d.obalka && !(await Dialog.potvrd('Odebrat obálku?', { ok: 'Odebrat' }))) return;
      d.obalka = d.obalka ? null : { html: '<p>Urozenému pánovi</p><p>Janu z Lomnice</p><p>na hradě Lomnici</p>', pecet: true };
      pohled = 'text'; uloz(); vse();
      if (d.obalka) zprava('Obálka je na konci – adresu přepište přímo na ní, pečeť je na horní chlopni.');
    }
  };
  async function odeberList(klic) {
    const dalsi = /^dalsi-\d+$/.test(klic || ''), x = dalsi ? d.dalsi[+klic.slice(6)] : d[klic];
    if (!x) return;
    if ((klic === 'obalka' || pismenHtml(x.html)) && !(await Dialog.potvrd('Odebrat list i s textem?', { ok: 'Odebrat' }))) return;
    if (dalsi) d.dalsi.splice(+klic.slice(6), 1); else d[klic] = null;
    uloz(); vse(); zavriNabidky();
  }
  /* Text, který se nevejde, po odstavcích přelít na další listy (podle potřeby přidá list). */
  function prelit() {
    if (!upravy()) { pohled = 'text'; vykresli(); }
    let presunuto = 0;
    for (let krok = 0; krok < 300; krok++) {
      const tela = [telo(), ...d.dalsi.map((_, i) => document.querySelector(`[data-telo-listu="dalsi-${i}"]`))];
      const i = tela.findIndex(t => t && t.scrollHeight > t.clientHeight + 2 && t.children.length > 1);
      if (i < 0) break;
      const t = tela[i], blok = t.lastElementChild;
      if (!d.dalsi[i]) d.dalsi.push({ html: '' });
      const cil = d.dalsi[i], prazdny = !pismenHtml(cil.html) && !/<img/.test(cil.html);
      cil.html = cisty(blok.outerHTML + (prazdny ? '' : cil.html));   // bez src (data URL) obrázků a dočasných tříd
      blok.remove();
      if (i === 0) d.html = cisty(t.innerHTML); else d.dalsi[i - 1].html = cisty(t.innerHTML);
      presunuto++; vykresli();
    }
    ulozText(); uloz(); vse();
    const zbyva = [...document.querySelectorAll('#listy .telo')].some(t => t.scrollHeight > t.clientHeight + 2);
    zprava(zbyva ? 'Některý odstavec je delší než celý list – rozdělte ho Enterem nebo zmenšete písmo.' : presunuto ? `Přelito odstavců: ${presunuto}. Listů s textem: ${1 + d.dalsi.length}.` : 'Všechen text se vejde.');
  }
  function vykresliListy() {
    $('nabListy').innerHTML = '<div class="titulek">Listy</div>'
      + '<button class="tl" data-prikaz="pridejList">➕ Další list</button>'
      + '<button class="tl" data-prikaz="prelit" title="Odstavce, které se nevejdou, přesune na další listy (a listy přidá)">⤵ Přelít přetékající text</button>'
      + `<button class="tl" data-prikaz="prepniRub">${d.rub ? '✓' : '　'} 🔄 Rub listu (zadní strana)</button>`
      + `<button class="tl" data-prikaz="prepniObalku">${d.obalka ? '✓' : '　'} ✉️ Obálka C6 – střih na A4</button>`
      + (d.obalka ? `<label class="tl"><input type="checkbox" data-obalka-pecet${d.obalka.pecet ? ' checked' : ''}> Pečeť na chlopni obálky</label>` : '')
      + (d.dalsi.length ? '<hr><div class="titulek">Další listy</div>' + d.dalsi.map((_, i) => `<button class="tl" data-odebrat-list="dalsi-${i}">🗑 Odebrat ${i + 2}. list</button>`).join('') : '')
      + '<p class="pozn" style="padding:4px 10px;margin:4px 0 0;max-width:300px">Podpis, datum a klíč jsou na posledním listu. Tisk a PDF obsahují všechny listy – rub tiskněte oboustranně.</p>';
  }
  document.addEventListener('change', e => { if (e.target.matches('[data-obalka-pecet]') && d.obalka) { d.obalka.pecet = e.target.checked; uloz(); vykresli(); } });
  // obrázek do vosku pečeti: načíst → editor (ořez, kontrast, průhledná barva) → do IndexedDB
  $('souborPecete').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const orig = await PERGAMEN_OBRAZEK.nacti(f);
      const v = await PERGAMEN_OBRAZEK.uprav(orig, Object.assign(P.VYCHOZI_OBRAZEK(), { rezim: 'cb', kontrast: 20 }));
      if (!v) return;
      const id = 'o' + noveId().replace(/[^a-z0-9]/gi, '');
      await ulozObrazek({ id, orig, vysledek: v.src, nastaveni: v.nastaveni });
      d.pecetObr = id; d.pecet = true; uloz(); vse();
      zprava('Obrázek je vtlačený do vosku – hloubku a směr reliéfu nastavíte v nabídce 🔏 Pečeť.');
    } catch (chyba) { Dialog.chyba(chyba.message); }
  });

  /* nabídky lišty */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    if (n.id === 'nabUkazky') vykresliUkazky();
    if (n.id === 'nabListy') vykresliListy();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-otevri]');
    if (o) { zavriNabidky(); return otevri(o.dataset.otevri); }
    const sb = e.target.closest('[data-sablona]'), sm = e.target.closest('[data-smaz-sablonu]');
    if (sm) { e.stopPropagation(); data.sablony.splice(+sm.dataset.smazSablonu, 1); uloz(); vykresliUkazky(); return; }
    if (sb) { zavriNabidky(); Object.assign(d, data.sablony[+sb.dataset.sablona].vzhled); d.pecetX = d.pecetY = null; uloz(); obnovVybery(); vse(); zprava('Vzhled použit – text zůstal.'); return; }
    const kr = e.target.closest('[data-kresba]');
    if (kr) { zavriNabidky(); return pridejKresbu(kr.dataset.kresba); }
    const ol = e.target.closest('[data-odebrat-list]');
    if (ol) { e.stopPropagation(); return odeberList(ol.dataset.odebratList); }
    const u = e.target.closest('[data-ukazka]');
    if (u) { zavriNabidky(); d = novy(u.dataset.ukazka); uloz(); obnovVybery(); vse(); novaHistorie(); return; }
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled && PRIKAZY[b.dataset.prikaz]) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](); }
    // cesta události místo closest: tlačítko, které se po kliknutí překreslí (filtr písem), už v DOM není
    if (!e.composedPath().some(n => n.classList && n.classList.contains('nabidka'))) zavriNabidky();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    const vPoli = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && !vPoli && !e.altKey && !document.querySelector('.po-zavoj, dialog[open]')) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); zpetDokument(); return; }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); znovuDokument(); return; }
    }
    if (e.key === 'F1') { e.preventDefault(); $('dlgNapoveda').showModal(); }
    // Ctrl + / Ctrl − / Ctrl 0 přibližují náhled (mimo textová pole)
    if ((e.ctrlKey || e.metaKey) && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); krokZoomu(1); }
      else if (e.key === '-') { e.preventDefault(); krokZoomu(-1); }
      else if (e.key === '0') { e.preventDefault(); nastavZoom('sirka'); }
    }
  });

  addEventListener('beforeprint', () => { if (!exportuje) rezimExportu(true); });
  addEventListener('afterprint', () => rezimExportu(false));

  window.PERGAMEN_APP = { obrazkyListu, get dokument() { return d; }, get meritko() { return meritko; }, get pohled() { return pohled; }, get vybrany() { return vybrany; }, obrazky, vlozObrazek, vykresli, cisty, sifrovanyHtml, prizpusob, nastavZoom, PRIKAZY };
  obnovVybery(); vse(); novaHistorie();
  nactiObrazky().then(() => { if (d.obrazky.length || /data-obr/.test(d.html) || d.pecetObr) vykresli(); });
  document.fonts.ready.then(prizpusobMeritko);
})();
