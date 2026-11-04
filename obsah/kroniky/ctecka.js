/* Kroniky vyhnanství – čtečka (UI nad KRONIKY_JADRO).
   localStorage: webapp_kroniky (nastavení, pozice, pokrok, čas čtení),
                 webapp_kroniky_poznamky (záložky, zvýraznění, cizi = načtené poznámky betačtenářů). */
(async () => {
  'use strict';
  const J = window.KRONIKY_JADRO;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_kroniky', KLIC_P = 'webapp_kroniky_poznamky';
  const plocha = $('plocha'), text = $('text');
  if (window.top === window) document.body.classList.add('samostatne');

  /* ---------- uložená data ---------- */
  const VYCHOZI_NAST = { motiv: 'web', pismo: 'patkove', velikost: 1, radkovani: 1.7, sirkaPct: 90, blok: true, knizni: false, obrazky: true, nezhasinat: false, bublina: 'dole', wpm: 220, tts: 1, hlas: '' };
  const cti = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  let stav = cti(KLIC);
  // starší verze čtečky ukládala jen {kniha, kapitola, velikost}
  if (typeof stav.kapitola === 'number') stav = { kniha: stav.kniha, staraKapitola: stav.kapitola, nast: { velikost: stav.velikost } };
  stav = { kniha: 0, pozice: {}, precteno: {}, cas: 0, dny: {}, panel: null, ...stav };
  stav.nast = { ...VYCHOZI_NAST, ...stav.nast };
  let data = { zalozky: [], zvyrazneni: [], cizi: [], ...cti(KLIC_P) };
  const nast = () => stav.nast;
  let casUlozeni = 0;
  function ulozStav(hned) {
    clearTimeout(casUlozeni);
    const zapis = () => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) {} };
    if (hned) zapis(); else casUlozeni = setTimeout(zapis, 400);
  }
  const ulozData = () => { try { localStorage.setItem(KLIC_P, JSON.stringify(data)); } catch (e) { Dialog.chyba('Poznámky se nepodařilo uložit (plné úložiště prohlížeče).'); } };
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- knihy a kapitoly ---------- */
  // knihy.json vždy čerstvý (?t – obejde i CDN GitHub Pages); kapitoly a obrázky s otiskem obsahu (?h)
  const knihy = await (await fetch('kroniky/knihy.json?t=' + Date.now())).json();
  const sOtiskem = (k, src) => { const h = k.otisky && k.otisky[src]; return `kroniky/${k.id}/${src}` + (h ? '?h=' + h : ''); };
  knihy.forEach(k => { k.slov = k.kapitoly.reduce((s, c) => s + c.slov, 0); });
  const mezipamet = new Map();
  function nactiKapitolu(kniha, soubor) {
    const c = kniha.kapitoly.find(x => x.soubor === soubor), h = c && c.h ? '?h=' + c.h : '';
    const klic = kniha.id + '/' + soubor + h;
    if (!mezipamet.has(klic)) {
      mezipamet.set(klic, fetch(`kroniky/${klic}`).then(r => {
        if (!r.ok) throw new Error('Kapitolu se nepodařilo načíst');
        return r.text();
      }).then(md => ({ md, bloky: J.rozeber(md) })).catch(e => { mezipamet.delete(klic); throw e; }));
    }
    return mezipamet.get(klic);
  }
  const nactiKnihu = kniha => Promise.all(kniha.kapitoly.map(c => nactiKapitolu(kniha, c.soubor)));
  const knihaPodleId = id => knihy.find(k => k.id === id);
  const indexKap = (kniha, soubor) => kniha.kapitoly.findIndex(c => c.soubor === soubor);

  let kniha = null, kapIdx = 0, bloky = [], kum = [];   // kum[i] = slova před blokem i
  const kap = () => kniha.kapitoly[kapIdx];

  /* ---------- nastavení vzhledu ---------- */
  const PISMA = {
    patkove: 'Georgia, "Times New Roman", serif',
    bezpatkove: 'system-ui, "Segoe UI", Roboto, sans-serif',
    sirsi: 'Verdana, "DejaVu Sans", sans-serif',
  };
  function pouzijNastaveni() {
    const n = nast(), s = document.body.style;
    const blok = aktualniBlok();
    document.body.dataset.motiv = n.motiv;
    s.setProperty('--velikost', n.velikost);
    s.setProperty('--radkovani', n.radkovani);
    s.setProperty('--sirka', n.sirkaPct + '%');
    s.setProperty('--pismo', PISMA[n.pismo] || PISMA.patkove);
    text.classList.toggle('blok', n.blok);
    text.classList.toggle('knizni', n.knizni);
    text.classList.toggle('bez-obrazku', !n.obrazky);
    aktualizujZamek();
    $('rVelikost').value = n.velikost; $('oVelikost').value = Math.round(n.velikost * 100) + ' %';
    $('rRadkovani').value = n.radkovani; $('oRadkovani').value = n.radkovani.toFixed(1);
    $('rSirka').value = n.sirkaPct; $('oSirka').value = n.sirkaPct + ' %';
    document.querySelectorAll('#nabZobrazeni .prep').forEach(b => {
      const [co, hodnota] = b.dataset.prikaz.split('-');
      b.setAttribute('aria-pressed', String(co === 'motiv' ? n.motiv === hodnota : co === 'pismo' ? n.pismo === hodnota : co === 'bublina' ? n.bublina === hodnota : !!n[co]));
    });
    if (bloky.length) skocNaBlok(blok, false);
    ulozStav();
  }
  const nastav = zmena => { Object.assign(stav.nast, zmena); pouzijNastaveni(); };
  [['rVelikost', 'velikost'], ['rRadkovani', 'radkovani'], ['rSirka', 'sirkaPct']].forEach(([id, klic]) =>
    $(id).addEventListener('input', e => nastav({ [klic]: +e.target.value })));

  /* ---------- vykreslení kapitoly ---------- */
  const htmlBloku = (b, i, knihaId = kniha.id) => b.typ === 'hr' ? `<hr data-i="${i}">`
    : b.typ === 'img' ? `<figure data-i="${i}"><img src="${J.esc(sOtiskem(knihaPodleId(knihaId) || kniha, b.src))}" alt="${J.esc(b.popis)}" loading="lazy" decoding="async">${b.popis ? `<figcaption>${J.esc(b.popis)}</figcaption>` : ''}</figure>`
    : b.typ === 'h' ? `<h1 data-i="${i}">${J.inline(b.md)}</h1>` : `<p data-i="${i}">${J.inline(b.md)}</p>`;
  const prvekBloku = i => text.querySelector(`[data-i="${i}"]`);

  async function otevri(kIdx, cIdx, blok = 0, volby = {}) {
    const nova = knihy[kIdx];
    if (!nova || !nova.kapitoly[cIdx]) return;
    if (!volby.zTts) zastavTts();
    let obsah;
    try { obsah = await nactiKapitolu(nova, nova.kapitoly[cIdx].soubor); }
    catch (e) { Dialog.chyba('Kapitolu se nepodařilo načíst. Jste offline?'); return; }
    kniha = nova; kapIdx = cIdx; stav.kniha = kIdx;
    bloky = obsah.bloky;
    kum = []; let s = 0;
    bloky.forEach((b, i) => { kum[i] = s; s += J.slov(b.text); });
    text.innerHTML = bloky.map((b, i) => htmlBloku(b, i)).join('');
    bloky.forEach((b, i) => { if (b.typ === 'p' || b.typ === 'h') vyznacBlok(i); });
    zavriVyber();
    $('zahlavi').textContent = `${kniha.nazev} · ${kniha.podtitul}`;
    $('tlKniha').title = `${kniha.nazev} – výběr knihy a pokrok čtení`;
    $('nabKnihaNazev').textContent = kniha.nazev;
    const prvni = cIdx === 0 && kIdx === 0, posledni = cIdx === kniha.kapitoly.length - 1 && kIdx === knihy.length - 1;
    ['tlPred', 'dolePred'].forEach(id => { $(id).disabled = prvni; });
    ['tlDalsi', 'doleDalsi'].forEach(id => { $(id).disabled = posledni; });
    $('doleDalsi').textContent = cIdx === kniha.kapitoly.length - 1 && !posledni ? `${knihy[kIdx + 1].nazev} ▶` : 'Další ▶';
    document.title = `${kap().nazev} – ${kniha.nazev} – Kroniky vyhnanství`;
    skocNaBlok(blok, false);
    poScrollu();
    if (stav.panel) vykresliPanel();
  }

  function skocNaBlok(i, plynule = true) {
    const el = prvekBloku(i);
    const cil = el && i > 0 ? Math.max(0, el.offsetTop - 14) : 0;
    plocha.scrollTo({ top: cil, behavior: plynule ? 'smooth' : 'auto' });
  }

  // první blok, jehož spodek je pod horní hranou plochy
  function aktualniBlok() {
    const prvky = text.children, hrana = plocha.scrollTop + 16;
    let lo = 0, hi = prvky.length - 1, vysl = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, el = prvky[mid];
      if (el.offsetTop + el.offsetHeight > hrana) { vysl = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return prvky[vysl] ? +prvky[vysl].dataset.i : 0;
  }

  const slovPred = (k, c) => k.kapitoly.slice(0, c).reduce((s, x) => s + x.slov, 0);
  const pokrokKnihy = k => {
    const p = stav.pozice[k.id];
    if (!p) return 0;
    const c = indexKap(k, p.soubor);
    return c < 0 ? 0 : (slovPred(k, c) + (p.slov || 0)) / k.slov;
  };

  let ramec = 0;
  function poScrollu() {
    ramec = 0;
    if (!kniha) return;
    const i = aktualniBlok(), slovZde = kum[i] || 0;
    stav.pozice[kniha.id] = { soubor: kap().soubor, blok: i, slov: slovZde };
    if (plocha.scrollTop + plocha.clientHeight >= plocha.scrollHeight - 40) {
      (stav.precteno[kniha.id] = stav.precteno[kniha.id] || {})[kap().soubor] = true;
    }
    const podil = (slovPred(kniha, kapIdx) + slovZde) / kniha.slov;
    $('prubeh').style.width = (podil * 100).toFixed(2) + '%';
    const wpm = nast().wpm, zbyvaKap = (kap().slov - slovZde) / wpm, zbyvaKniha = kniha.slov * (1 - podil) / wpm;
    $('stavCteni').textContent = `Kapitola ${kapIdx + 1} z ${kniha.kapitoly.length} · do konce kapitoly ~${J.formatCas(zbyvaKap)} · kniha ${Math.floor(podil * 100)} %, zbývá ~${J.formatCas(zbyvaKniha)}`;
    const okno = plocha.getBoundingClientRect();
    const maZalozku = [...text.querySelectorAll('mark.zal-slovo')].some(m => { const r = m.getBoundingClientRect(); return r.bottom > okno.top && r.top < okno.bottom; });
    $('tlZalozka').setAttribute('aria-pressed', String(maZalozku));
    kresliPosuvnik();
    ulozStav();
  }
  plocha.addEventListener('scroll', () => { aktivita(); if (!ramec) ramec = requestAnimationFrame(poScrollu); }, { passive: true });

  const posun = smer => {
    let k = stav.kniha, c = kapIdx + smer;
    if (c < 0) { k--; if (k < 0) return; c = knihy[k].kapitoly.length - 1; }
    if (c >= knihy[k].kapitoly.length) { k++; if (k >= knihy.length) return; c = 0; }
    otevri(k, c);
  };

  async function skok(knihaId, soubor, blok, hledany, zalozkaId) {
    const k = knihy.findIndex(x => x.id === knihaId), c = k < 0 ? -1 : indexKap(knihy[k], soubor);
    if (c < 0) { Dialog.chyba('Toto místo už v knize není.'); return; }
    if (k !== stav.kniha || c !== kapIdx) await otevri(k, c, blok);
    if (hledany) vyznacBlok(blok, hledany);
    const slovo = zalozkaId && text.querySelector(`mark.zal-slovo[data-zal="${zalozkaId}"]`);
    if (slovo) {
      // slovo záložky do horní třetiny plochy, jeho věta krátce blikne
      plocha.scrollTo({ top: plocha.scrollTop + slovo.getBoundingClientRect().top - plocha.getBoundingClientRect().top - plocha.clientHeight / 3, behavior: 'smooth' });
      const veta = text.querySelectorAll(`.zal-veta[data-zal="${zalozkaId}"]`);
      veta.forEach(v => v.classList.add('blik'));
      setTimeout(() => veta.forEach(v => v.classList.remove('blik')), 1800);
    } else {
    const el = prvekBloku(blok);
    if (el) {
      skocNaBlok(blok);
      el.classList.add('blik');
      setTimeout(() => el.classList.remove('blik'), 1600);
    }
    }
    if (matchMedia('(max-width:760px)').matches) zavriPanel();
  }

  /* ---------- zvýraznění, záložky, nálezy v textu ---------- */
  // obalí znaky od–do (v textContent prvku) do nových prvků, i přes hranice <em>
  function obal(el, od, do_, vytvor) {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), uzly = [];
    let pos = 0, n;
    while ((n = tw.nextNode())) { uzly.push([n, pos]); pos += n.length; }
    for (const [uzel0, start] of uzly) {
      const a = Math.max(od, start), b = Math.min(do_, start + uzel0.length);
      if (a >= b) continue;
      let uzel = uzel0;
      if (b - start < uzel.length) uzel.splitText(b - start);
      if (a - start > 0) uzel = uzel.splitText(a - start);
      const m = vytvor();
      uzel.parentNode.insertBefore(m, uzel);
      m.appendChild(uzel);
    }
  }

  // text knihy se může po redakci změnit – zvýraznění se dohledá podle citace
  function ukotvi(z) {
    if (bloky[z.blok] && bloky[z.blok].text.slice(z.od, z.do) === z.text) return true;
    for (let i = 0; i < bloky.length; i++) {
      const p = bloky[(z.blok + i) % bloky.length].text.indexOf(z.text);
      if (p >= 0) { z.blok = (z.blok + i) % bloky.length; z.od = p; z.do = p + z.text.length; ulozData(); return true; }
    }
    return false;
  }

  // záložka = slovo + věta; po redakci se dohledá podle věty, pak podle slova; stará záložka na odstavec → první slovo
  function ukotviZalozku(z) {
    const t = bloky[z.blok] && bloky[z.blok].text;
    const nastav = (blok, rozsah) => {
      const txt = bloky[blok].text, v = J.vetaKolem(txt, rozsah.od);
      Object.assign(z, { blok, od: rozsah.od, do: rozsah.do, slovo: txt.slice(rozsah.od, rozsah.do), veta: txt.slice(v.od, v.do), vOd: rozsah.od - v.od });
      ulozData();
      return true;
    };
    if (z.od == null) { const w = t && J.slovoKolem(t, 0); return w ? nastav(z.blok, w) : false; }
    if (t && t.slice(z.od, z.do) === z.slovo) return true;
    for (let k = 0; k < bloky.length; k++) {
      const i = (z.blok + k) % bloky.length, p = z.veta ? bloky[i].text.indexOf(z.veta) : -1;
      if (p >= 0) return nastav(i, { od: p + z.vOd, do: p + z.vOd + z.slovo.length });
    }
    if (t) {
      const slova = [...t.matchAll(new RegExp(z.slovo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map(m => m.index);
      if (slova.length) { const p = slova.reduce((a, b) => Math.abs(b - z.od) < Math.abs(a - z.od) ? b : a); return nastav(z.blok, { od: p, do: p + z.slovo.length }); }
      const w = J.slovoKolem(t, 0);
      if (w) return nastav(z.blok, w);
    }
    return false;
  }

  function vyznacBlok(i, hledany) {
    const el = prvekBloku(i), b = bloky[i];
    if (!el || !b || (b.typ !== 'p' && b.typ !== 'h')) return;
    el.innerHTML = J.inline(b.md);
    const soubor = kap().soubor;
    data.zvyrazneni
      .filter(z => z.kniha === kniha.id && z.soubor === soubor && ukotvi(z) && z.blok === i)
      .sort((a, b) => a.od - b.od)
      .forEach(z => obal(el, z.od, z.do, () => {
        const m = document.createElement('mark');
        m.className = 'zv' + (z.poznamka ? ' ma-pozn' : '');
        m.dataset.id = z.id; m.dataset.barva = z.barva;
        if (z.poznamka) m.title = z.poznamka;
        return m;
      }));
    data.cizi.filter(c => !c.skryta).forEach(c => c.zvyrazneni
      .filter(z => z.kniha === kniha.id && z.soubor === soubor && ukotvi(z) && z.blok === i)
      .forEach(z => obal(el, z.od, z.do, () => {
        const m = Object.assign(document.createElement('mark'), { className: 'zv cizi', title: `👤 ${c.jmeno || 'čtenář'}` + (z.poznamka ? ': ' + z.poznamka : '') });
        m.dataset.cizi = c.id; m.dataset.id = z.id;
        return m;
      })));
    data.zalozky
      .filter(z => z.kniha === kniha.id && z.soubor === soubor && ukotviZalozku(z) && z.blok === i)
      .forEach(z => {
        const v = J.vetaKolem(b.text, z.od);
        obal(el, v.od, v.do, () => { const sp = document.createElement('span'); sp.className = 'zal-veta'; sp.dataset.zal = z.id; return sp; });
        obal(el, z.od, z.do, () => {
          const m = Object.assign(document.createElement('mark'), { className: 'zal-slovo', title: 'Záložka – klepnutím odeberete' });
          m.dataset.zal = z.id;
          return m;
        });
      });
    planujZnacky();
    if (hledany) {
      const t = J.normalizuj(b.text), q = J.normalizuj(hledany);
      const pozice = [];
      for (let p = t.indexOf(q); p >= 0 && q; p = t.indexOf(q, p + q.length)) pozice.push(p);
      pozice.reverse().forEach(p => obal(el, p, p + q.length, () => Object.assign(document.createElement('mark'), { className: 'nalez' })));
    }
  }

  // první slovo na prvním celém řádku nahoře (bez označeného textu)
  function prvniViditelneSlovo() {
    const p = plocha.getBoundingClientRect(), t = text.getBoundingClientRect();
    for (let y = p.top + 20; y < p.top + 260; y += 10) {
      let uzel, off;
      if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(t.left + 2, y); if (r) { uzel = r.startContainer; off = r.startOffset; } }
      else if (document.caretPositionFromPoint) { const r = document.caretPositionFromPoint(t.left + 2, y); if (r) { uzel = r.offsetNode; off = r.offset; } }
      const el = uzel && blokZUzlu(uzel);
      if (!el || !/^(P|H1)$/.test(el.tagName)) continue;
      const i = +el.dataset.i, w = J.slovoKolem(bloky[i].text, offsetV(el, uzel, off));
      if (w) return { blok: i, ...w };
    }
    for (let i = aktualniBlok(); i < bloky.length; i++) { const w = bloky[i].text && J.slovoKolem(bloky[i].text, 0); if (w) return { blok: i, ...w }; }
    return null;
  }

  // záložka na označeném slově (výběr se rozšíří na celá slova), jinak na prvním viditelném slově
  function prepniZalozku() {
    if (!kniha) return;
    const cil = vyber && vyber.rezim === 'novy'
      ? (w => w && { blok: vyber.blok, ...w })(J.slovoKolem(bloky[vyber.blok].text, vyber.od, vyber.do))
      : prvniViditelneSlovo();
    zavriVyber(); getSelection().removeAllRanges();
    if (!cil) { Dialog.info('Tady není slovo, ke kterému by šla záložka připnout.'); return; }
    const soubor = kap().soubor;
    const idx = data.zalozky.findIndex(z => z.kniha === kniha.id && z.soubor === soubor && z.blok === cil.blok && z.od < cil.do && cil.od < z.do);
    if (idx >= 0) { data.zalozky.splice(idx, 1); Dialog.info('Záložka odebrána'); }
    else {
      const t = bloky[cil.blok].text, v = J.vetaKolem(t, cil.od);
      const z = { id: noveId(), kniha: kniha.id, soubor, blok: cil.blok, od: cil.od, do: cil.do,
        slovo: t.slice(cil.od, cil.do), veta: t.slice(v.od, v.do), vOd: cil.od - v.od, cas: Date.now() };
      data.zalozky.push(z);
      Dialog.info(`🔖 Záložka u slova „${z.slovo.length > 40 ? z.slovo.slice(0, 40) + '…' : z.slovo}“`);
    }
    ulozData(); vyznacBlok(cil.blok); poScrollu();
    if (stav.panel === 'zalozky') vykresliPanel();
  }
  async function odeberZalozku(id) {
    const z = data.zalozky.find(x => x.id === id);
    if (!z || !(await Dialog.potvrd(`Odebrat záložku u slova „${z.slovo || ''}“?`))) return;
    data.zalozky = data.zalozky.filter(x => x !== z);
    ulozData();
    if (kniha && z.kniha === kniha.id && z.soubor === kap().soubor) vyznacBlok(z.blok);
    poScrollu();
    if (stav.panel === 'zalozky') vykresliPanel();
  }

  /* ---------- výběr textu → plovoucí lišta ---------- */
  const lista = $('vyber');
  let vyber = null;   // {rezim:'novy', blok, od, do, text} | {rezim:'uprava', id}
  function ukazListu(rect) {
    lista.hidden = false;
    const dolu = matchMedia('(pointer:coarse)').matches || rect.top < 70;
    const top = dolu ? rect.bottom + 10 : rect.top - lista.offsetHeight - 8;
    lista.style.top = Math.max(6, Math.min(innerHeight - lista.offsetHeight - 6, top)) + 'px';
    lista.style.left = Math.max(6, Math.min(innerWidth - lista.offsetWidth - 6, rect.left + rect.width / 2 - lista.offsetWidth / 2)) + 'px';
    lista.querySelector('[data-vyber="smazat"]').hidden = vyber.rezim !== 'uprava';
    lista.querySelector('[data-vyber="zalozka"]').hidden = vyber.rezim !== 'novy';
  }
  function zavriVyber() { lista.hidden = true; vyber = null; }
  const blokZUzlu = u => { const el = (u.nodeType === 3 ? u.parentElement : u).closest('#text [data-i]'); return el; };
  const offsetV = (el, uzel, off) => { const r = document.createRange(); r.setStart(el, 0); r.setEnd(uzel, off); return r.toString().length; };

  let casVyberu = 0;
  document.addEventListener('selectionchange', () => {
    clearTimeout(casVyberu);
    casVyberu = setTimeout(() => {
      const sel = getSelection();
      if (!sel.rangeCount || sel.isCollapsed) { if (vyber && vyber.rezim === 'novy') zavriVyber(); return; }
      const r = sel.getRangeAt(0), el = blokZUzlu(r.startContainer);
      if (!el || el !== blokZUzlu(r.endContainer) || !/^(P|H1)$/.test(el.tagName)) { if (vyber && vyber.rezim === 'novy') zavriVyber(); return; }
      const od = offsetV(el, r.startContainer, r.startOffset), do_ = offsetV(el, r.endContainer, r.endOffset);
      const i = +el.dataset.i, t = bloky[i].text.slice(od, do_);
      if (!t.trim()) return;
      vyber = { rezim: 'novy', blok: i, od, do: do_, text: t };
      ukazListu(r.getBoundingClientRect());
    }, 180);
  });
  text.addEventListener('click', e => {
    const zal = e.target.closest('mark.zal-slovo');
    if (zal && getSelection().isCollapsed) { odeberZalozku(zal.dataset.zal); return; }
    const ciz = e.target.closest('mark.cizi');
    if (ciz && getSelection().isCollapsed) { ukazCizi(ciz.dataset.cizi, ciz.dataset.id); return; }
    const m = e.target.closest('mark.zv');
    if (!m || !getSelection().isCollapsed) return;
    vyber = { rezim: 'uprava', id: m.dataset.id };
    ukazListu(m.getBoundingClientRect());
  });
  lista.addEventListener('pointerdown', e => e.preventDefault());   // výběr nezmizí kliknutím do lišty
  lista.addEventListener('click', async e => {
    const tl = e.target.closest('button');
    if (!tl || !vyber) return;
    if (tl.dataset.vyber === 'zalozka') { if (vyber.rezim === 'novy') prepniZalozku(); return; }
    const v = vyber;
    let z = v.rezim === 'uprava' ? data.zvyrazneni.find(x => x.id === v.id) : null;
    const nove = barva => {
      z = { id: noveId(), kniha: kniha.id, soubor: kap().soubor, blok: v.blok, od: v.od, do: v.do, text: v.text, barva, poznamka: '', cas: Date.now() };
      data.zvyrazneni.push(z);
    };
    if (tl.dataset.barva) {
      if (z) z.barva = tl.dataset.barva; else nove(tl.dataset.barva);
    } else if (tl.dataset.vyber === 'poznamka') {
      zavriVyber(); getSelection().removeAllRanges();
      const p = await Dialog.zeptej('Poznámka k vybranému textu', z ? z.poznamka : '', { ok: 'Uložit' });
      if (p === null) return;
      if (!z) nove('zluta');
      z.poznamka = p.trim();
    } else if (tl.dataset.vyber === 'citace') {
      kopiruj(citace(z ? z.text : v.text), 'Citace zkopírována');
    } else if (tl.dataset.vyber === 'smazat' && z) {
      data.zvyrazneni = data.zvyrazneni.filter(x => x !== z);
    }
    ulozData();
    zavriVyber(); getSelection().removeAllRanges();
    vyznacBlok(z ? z.blok : v.blok);
    if (stav.panel === 'poznamky') vykresliPanel();
  });
  const citace = t => `„${t.trim()}“\n— Kroniky vyhnanství, ${kniha.nazev}, ${kap().nazev}`;
  async function kopiruj(t, hlaska) {
    try { await navigator.clipboard.writeText(t); Dialog.info(hlaska); }
    catch (e) { await Dialog.zeptej('Zkopírujte si text:', t, { ok: 'Hotovo' }); }
  }

  /* ---------- postranní panel ---------- */
  const panel = $('panel'), panelObsah = $('panelObsah');
  function otevriPanel(karta) {
    stav.panel = karta; panel.hidden = false; vykresliPanel(); ulozStav();
  }
  function zavriPanel() { stav.panel = null; panel.hidden = true; $('tlObsah').setAttribute('aria-pressed', 'false'); ulozStav(); }
  const prepniPanel = karta => (stav.panel === karta && !panel.hidden ? zavriPanel() : otevriPanel(karta));
  panel.querySelector('.karty').addEventListener('click', e => { const b = e.target.closest('[data-karta]'); if (b) otevriPanel(b.dataset.karta); });

  const datum = t => new Date(t).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const poradi = x => { const k = knihy.findIndex(b => b.id === x.kniha); return [k, indexKap(knihy[k] || knihy[0], x.soubor), x.blok, x.od || 0]; };
  const podlePoradi = (a, b) => { const pa = poradi(a), pb = poradi(b); for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return 0; };
  const nazevKap = x => { const soubor = x.soubor || x.kap, k = knihaPodleId(x.kniha), c = k && k.kapitoly[indexKap(k, soubor)]; return c ? c.nazev : soubor; };
  const skokAttr = (x, hledany, zal) => `data-skok="${x.kniha}|${x.soubor || x.kap}|${x.blok}"${hledany ? ` data-hledany="${J.esc(hledany)}"` : ''}${zal ? ` data-zal="${zal}"` : ''}`;
  // věta záložky s vyznačeným slovem (dlouhé okraje zkrácené)
  const vetaZalozky = (z, f = (pred, slovo, po) => J.esc(pred) + '<b>' + J.esc(slovo) + '</b>' + J.esc(po)) => {
    if (!z.veta) return f(z.ukazka || '', '', '');
    const pred = z.veta.slice(0, z.vOd), po = z.veta.slice(z.vOd + z.slovo.length);
    return f(pred.length > 90 ? '…' + pred.slice(-90) : pred, z.slovo, po.length > 120 ? po.slice(0, 120) + '…' : po);
  };

  let vysledky = null, dotaz = '';
  function vykresliPanel() {
    panel.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.karta === stav.panel)));
    $('tlObsah').setAttribute('aria-pressed', String(stav.panel === 'obsah'));
    const e = J.esc;
    let h = '';
    if (stav.panel === 'obsah') {
      knihy.forEach((k, ki) => {
        h += `<h3>${k.obalka ? `<img class="obalka-mini" src="${e(sOtiskem(k, k.obalka))}" alt="">` : ''}${e(k.nazev)} · ${Math.floor(pokrokKnihy(k) * 100)} %</h3>`;
        k.kapitoly.forEach((c, ci) => {
          const precteno = stav.precteno[k.id] && stav.precteno[k.id][c.soubor];
          const akt = kniha && k.id === kniha.id && ci === kapIdx;
          h += `<button class="polozka${akt ? ' aktivni' : ''}" data-kap="${ki}|${ci}"><span class="znak">${precteno ? '✓' : ''}</span><span>${e(c.nazev)}</span><span class="meta">${J.formatCas(c.slov / nast().wpm)}</span></button>`;
        });
      });
    } else if (stav.panel === 'hledani') {
      if (!dotaz) h = '<p class="prazdne">Napište hledaný text do pole 🔍 v liště (aspoň 2 znaky). Hledá se v obou knihách bez ohledu na diakritiku a velká písmena.</p>';
      else if (!vysledky) h = '<p class="prazdne">Hledám…</p>';
      else if (!vysledky.length) h = `<p class="prazdne">„${e(dotaz)}“ v knihách není.</p>`;
      else {
        h = `<p class="prazdne">${vysledky.length >= 300 ? 'Prvních 300' : vysledky.length} výskytů „${e(dotaz)}“</p>`;
        let skupina = '';
        vysledky.forEach(v => {
          const s = v.kniha + v.kap;
          if (s !== skupina) { skupina = s; h += `<h3>${e(knihaPodleId(v.kniha).nazev)} – ${e(nazevKap(v))}</h3>`; }
          h += `<button class="polozka vysledek" ${skokAttr(v, dotaz)}><span>${e(v.pred)}<mark class="nalez">${e(v.shoda)}</mark>${e(v.po)}</span></button>`;
        });
      }
    } else if (stav.panel === 'zalozky') {
      const z = [...data.zalozky].sort(podlePoradi);
      h = z.length ? '' : '<p class="prazdne">Zatím žádné záložky. Označte v textu slovo a klepněte na 🔖 (nebo klávesa B). Bez označení se záložka připne na první slovo nahoře na obrazovce.</p>';
      z.forEach(x => {
        h += `<div class="polozka pozn" role="button" tabindex="0" ${skokAttr(x, '', x.id)}><small>🔖 ${e(knihaPodleId(x.kniha)?.nazev || '')} · ${e(nazevKap(x))} · ${datum(x.cas)}</small><span class="veta-zal">${vetaZalozky(x)}</span>
          <span class="panel-akce"><button class="tl" data-smaz-z="${x.id}">✕ Odebrat</button></span></div>`;
      });
    } else if (stav.panel === 'poznamky') {
      const z = [...data.zvyrazneni].sort(podlePoradi);
      h = `<div class="panel-akce"><button class="tl" data-prikaz="odeslat-poznamky">📤 Odeslat autorovi</button><button class="tl" data-prikaz="exp-poznamky">⬇ Markdown</button><button class="tl" data-prikaz="nacist-poznamky">📂 Načíst od čtenáře</button></div>`;
      if (!z.length) h += '<p class="prazdne">Zatím žádné poznámky. Označte v textu pár slov a vyberte barvu nebo 📝.</p>';
      let skupina = '';
      z.forEach(x => {
        const s = x.kniha + x.soubor;
        if (s !== skupina) { skupina = s; h += `<h3>${e(knihaPodleId(x.kniha)?.nazev || '')} – ${e(nazevKap(x))}</h3>`; }
        h += `<div class="polozka pozn" role="button" tabindex="0" ${skokAttr(x)} style="border-left:4px solid var(--zv-${x.barva})"><q>${e(x.text)}</q>${x.poznamka ? `<span class="text-pozn">📝 ${e(x.poznamka)}</span>` : ''}
          <span class="panel-akce"><button class="tl" data-uprav-p="${x.id}">📝 Poznámka</button><button class="tl" data-smaz-p="${x.id}">✕ Smazat</button></span></div>`;
      });
      data.cizi.forEach(c => {
        h += `<h3 class="cizi-hlava">👤 ${e(c.jmeno || 'Čtenář bez jména')} · ${c.zvyrazneni.length} pozn. · ${datum(c.cas)}</h3>
          <div class="panel-akce"><button class="tl" data-cizi-skryj="${c.id}">${c.skryta ? '👁 Zobrazit v textu' : '🙈 Skrýt v textu'}</button><button class="tl" data-cizi-smaz="${c.id}">✕ Odebrat</button></div>`;
        [...c.zvyrazneni].sort(podlePoradi).forEach(x => {
          h += `<div class="polozka pozn cizi" role="button" tabindex="0" data-pozn="${x.id}" ${skokAttr(x)}><small>${e(knihaPodleId(x.kniha)?.nazev || '')} · ${e(nazevKap(x))}</small><q>${e(x.text)}</q>${x.poznamka ? `<span class="text-pozn">📝 ${e(x.poznamka)}</span>` : ''}</div>`;
        });
        [...c.zalozky].sort(podlePoradi).forEach(x => {
          h += `<div class="polozka pozn cizi" role="button" tabindex="0" ${skokAttr(x)}><small>🔖 ${e(knihaPodleId(x.kniha)?.nazev || '')} · ${e(nazevKap(x))}</small><span class="veta-zal">${vetaZalozky(x)}</span></div>`;
        });
      });
    }
    panelObsah.innerHTML = h;
    const akt = panelObsah.querySelector('.aktivni');
    if (akt) akt.scrollIntoView({ block: 'center' });
  }
  document.body.style.cssText += ';--zv-zluta:#ffd54f;--zv-zelena:#81c784;--zv-modra:#64b5f6;--zv-ruzova:#f06292';

  panelObsah.addEventListener('click', async e => {
    const t = e.target.closest('[data-kap],[data-skok],[data-smaz-z],[data-smaz-p],[data-uprav-p],[data-cizi-skryj],[data-cizi-smaz]');
    if (!t) return;
    if (t.dataset.ciziSkryj || t.dataset.ciziSmaz) {
      const c = data.cizi.find(x => x.id === (t.dataset.ciziSkryj || t.dataset.ciziSmaz));
      if (!c) return;
      if (t.dataset.ciziSkryj) c.skryta = !c.skryta;
      else if (await Dialog.potvrd(`Odebrat poznámky čtenáře ${c.jmeno || 'bez jména'}?`)) data.cizi = data.cizi.filter(x => x !== c);
      else return;
      ulozData(); vykresliPanel(); prekresliText();
      return;
    }
    if (t.dataset.smazZ) {
      data.zalozky = data.zalozky.filter(z => z.id !== t.dataset.smazZ);
      ulozData(); vykresliPanel(); if (kniha) { new Set([...text.querySelectorAll('mark.zal-slovo')].map(m => +m.closest('[data-i]').dataset.i)).forEach(vyznacBlok); poScrollu(); }
      return;
    }
    if (t.dataset.smazP || t.dataset.upravP) {
      const z = data.zvyrazneni.find(x => x.id === (t.dataset.smazP || t.dataset.upravP));
      if (!z) return;
      if (t.dataset.smazP) {
        if (z.poznamka && !(await Dialog.potvrd('Smazat zvýraznění i s poznámkou?'))) return;
        data.zvyrazneni = data.zvyrazneni.filter(x => x !== z);
      } else {
        const p = await Dialog.zeptej('Poznámka', z.poznamka, { ok: 'Uložit' });
        if (p === null) return;
        z.poznamka = p.trim();
      }
      ulozData(); vykresliPanel();
      if (kniha && z.kniha === kniha.id && z.soubor === kap().soubor) vyznacBlok(z.blok);
      return;
    }
    if (t.dataset.kap) {
      const [k, c] = t.dataset.kap.split('|').map(Number);
      await otevri(k, c);
      if (matchMedia('(max-width:760px)').matches) zavriPanel();
      return;
    }
    const [k, soubor, blok] = t.dataset.skok.split('|');
    skok(k, soubor, +blok, t.dataset.hledany, t.dataset.zal);
  });
  panelObsah.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[role=button]')) e.target.click(); });

  /* ---------- hledání ---------- */
  let casHledani = 0, cisloHledani = 0;
  $('hledat').addEventListener('input', e => {
    clearTimeout(casHledani);
    casHledani = setTimeout(() => hledej(e.target.value), 250);
  });
  $('hledat').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const prvni = panelObsah.querySelector('.vysledek'); if (prvni) prvni.click(); }
    if (e.key === 'Escape') { e.target.value = ''; hledej(''); e.target.blur(); }
  });
  async function hledej(q) {
    dotaz = q.trim();
    const cislo = ++cisloHledani;
    if (dotaz.length < 2) { vysledky = null; dotaz = ''; if (stav.panel === 'hledani') vykresliPanel(); return; }
    vysledky = null; otevriPanel('hledani');
    try {
      const vse = [];
      for (const k of knihy) {
        const obsahy = await nactiKnihu(k);
        k.kapitoly.forEach((c, i) => vse.push({ kniha: k.id, kap: c.soubor, bloky: obsahy[i].bloky }));
      }
      if (cislo !== cisloHledani) return;
      vysledky = J.hledej(vse, dotaz);
    } catch (e) { vysledky = []; Dialog.chyba('Některé kapitoly se nepodařilo načíst.'); }
    vykresliPanel();
  }

  /* ---------- předčítání ---------- */
  const tts = { aktivni: false, pauza: false, blok: 0, vety: [], vi: 0, gen: 0 };
  const synt = window.speechSynthesis;
  if (!synt) $('tlPredcitat').disabled = true;
  function hlasy() {
    if (!synt) return [];
    const v = synt.getVoices(), cs = v.filter(x => /^cs/i.test(x.lang));
    return cs.length ? cs : v;
  }
  function naplnHlasy() {
    const v = hlasy();
    $('ttsHlas').innerHTML = '<option value="">Výchozí hlas</option>' + v.map(x => `<option value="${J.esc(x.name)}">${J.esc(x.name)} (${x.lang})</option>`).join('');
    $('ttsHlas').value = v.some(x => x.name === nast().hlas) ? nast().hlas : '';
  }
  if (synt) { naplnHlasy(); synt.addEventListener?.('voiceschanged', naplnHlasy); }
  $('ttsRychlost').value = String(nast().tts);
  $('ttsRychlost').onchange = e => { nast().tts = +e.target.value; ulozStav(); if (tts.aktivni && !tts.pauza) mluv(); };
  $('ttsHlas').onchange = e => { nast().hlas = e.target.value; ulozStav(); if (tts.aktivni && !tts.pauza) mluv(); };

  function oznacCteny() {
    text.querySelectorAll('.cte').forEach(el => el.classList.remove('cte'));
    const el = prvekBloku(tts.blok);
    if (!el) return;
    el.classList.add('cte');
    const r = el.getBoundingClientRect(), p = plocha.getBoundingClientRect();
    if (r.top < p.top + 10 || r.top > p.bottom - 80) plocha.scrollTo({ top: el.offsetTop - plocha.clientHeight / 3, behavior: 'smooth' });
  }
  async function mluv() {
    const gen = ++tts.gen;
    synt.cancel();
    while (tts.blok < bloky.length && !bloky[tts.blok].text) tts.blok++;
    if (tts.blok >= bloky.length) {
      const k = stav.kniha, posledniKap = kapIdx === kniha.kapitoly.length - 1;
      if (posledniKap && k === knihy.length - 1) return zastavTts();
      await otevri(posledniKap ? k + 1 : k, posledniKap ? 0 : kapIdx + 1, 0, { zTts: true });
      if (gen !== tts.gen) return;
      tts.blok = 0; tts.vi = 0; tts.vety = [];
      return mluv();
    }
    if (!tts.vety.length) tts.vety = J.vety(bloky[tts.blok].text);
    oznacCteny();
    const u = new SpeechSynthesisUtterance(tts.vety[tts.vi] || '');
    u.lang = 'cs-CZ'; u.rate = nast().tts;
    const hlas = hlasy().find(x => x.name === nast().hlas);
    if (hlas) u.voice = hlas;
    u.onend = () => {
      if (gen !== tts.gen) return;
      aktivita();
      if (++tts.vi >= tts.vety.length) { tts.blok++; tts.vi = 0; tts.vety = []; }
      mluv();
    };
    u.onerror = e => {
      if (gen !== tts.gen || e.error === 'interrupted' || e.error === 'canceled') return;
      Dialog.chyba('Předčítání selhalo: ' + e.error); zastavTts();
    };
    synt.speak(u);
  }
  function spustTts() {
    if (!synt || !kniha) return;
    if (tts.aktivni) return pauzaTts();
    if (!synt.getVoices().length) { Dialog.chyba('Prohlížeč nemá žádný hlas pro předčítání (v systému chybí řečový modul).'); return; }
    Object.assign(tts, { aktivni: true, pauza: false, blok: aktualniBlok(), vi: 0, vety: [] });
    $('tts').hidden = false; $('ttsPauza').textContent = '⏸';
    $('tlPredcitat').setAttribute('aria-pressed', 'true');
    aktualizujZamek();
    if (!hlasy().some(x => /^cs/i.test(x.lang))) Dialog.info('Prohlížeč nemá český hlas – čte se výchozím hlasem.');
    mluv();
  }
  function pauzaTts() {
    tts.pauza = !tts.pauza;
    $('ttsPauza').textContent = tts.pauza ? '▶' : '⏸';
    if (tts.pauza) { tts.gen++; synt.cancel(); } else mluv();
    aktualizujZamek();
  }
  function zastavTts() {
    if (!tts.aktivni) return;
    tts.aktivni = false; tts.gen++;
    synt && synt.cancel();
    $('tts').hidden = true;
    $('tlPredcitat').setAttribute('aria-pressed', 'false');
    aktualizujZamek();
    text.querySelectorAll('.cte').forEach(el => el.classList.remove('cte'));
  }
  const ttsSkok = smer => {
    let i = tts.blok + smer;
    while (bloky[i] && !bloky[i].text) i += smer;
    tts.blok = Math.max(0, i); tts.vi = 0; tts.vety = []; tts.pauza = false; $('ttsPauza').textContent = '⏸';
    mluv();
  };
  $('ttsPauza').onclick = pauzaTts;
  $('ttsStop').onclick = zastavTts;
  $('ttsZpet').onclick = () => ttsSkok(-1);
  $('ttsVpred').onclick = () => ttsSkok(1);
  addEventListener('pagehide', () => { synt && synt.cancel(); ulozStav(true); });
  // Karta otevřená celé dny (tablet) by běžela na starém kódu, zatímco kapitoly se stahují nové –
  // po návratu do karty porovnat skripty se serverem a při změně stránku obnovit (pozice je uložená).
  const otiskSkriptu = () => Promise.all(['kroniky/jadro.js', 'kroniky/ctecka.js', 'kroniky/knihy.json?t=' + Date.now()].map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? r.text() : '')))
    .then(t => t.join('\n')).catch(() => '');
  const puvodniOtisk = otiskSkriptu();
  let skrytoOd = 0;
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') { skrytoOd = Date.now(); ulozStav(true); return; }
    if (skrytoOd && Date.now() - skrytoOd > 10 * 60e3 && !tts.aktivni) {
      const [stary, novy] = await Promise.all([puvodniOtisk, otiskSkriptu()]);
      if (stary && novy && stary !== novy) { ulozStav(true); location.reload(); return; }
    }
    aktualizujZamek();   // zámek obrazovky se při skrytí stránky sám uvolní
    // zamčený telefon řeč prohlížeče zastaví – po odemčení pokračovat od přerušené věty
    if (tts.aktivni && !tts.pauza && synt && !synt.speaking) mluv();
  });

  /* ---------- obrazovka nezhasne během předčítání (nebo vždy, je-li zapnuto) ---------- */
  let zamek = null, zadamZamek = false;
  async function aktualizujZamek() {
    const chci = (tts.aktivni && !tts.pauza) || nast().nezhasinat;
    if (chci && !zamek && !zadamZamek && navigator.wakeLock && document.visibilityState === 'visible') {
      zadamZamek = true;
      try {
        zamek = await navigator.wakeLock.request('screen');
        zamek.addEventListener('release', () => { zamek = null; });
      } catch (e) { /* prohlížeč nebo rámec zámek nedovolí – nevadí */ }
      zadamZamek = false;
    } else if (!chci && zamek) { zamek.release().catch(() => {}); zamek = null; }
  }

  /* ---------- soustředěné čtení ---------- */
  // Brave/Chrome na iPadu a iPhonu celou obrazovku webu nepovolí (lišta prohlížeče zůstane) –
  // jednou za návštěvu poradit přidání na plochu, odkud se čtečka spouští bez lišt
  let radaPlocha = false;
  function celaObrazovka() {
    const el = document.documentElement;
    let pozadavek;
    try { pozadavek = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : Promise.reject(); }
    catch (e) { pozadavek = Promise.reject(e); }
    Promise.resolve(pozadavek).catch(() => {
      const ios = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const zPlochy = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
      if (!ios || zPlochy || radaPlocha) return;
      radaPlocha = true;
      Dialog.info('Prohlížeč na iPadu nedovolí skrýt svou lištu. Pro čtení přes celou obrazovku přidejte čtečku na plochu (v nabídce prohlížeče Sdílet → Přidat na plochu) a spouštějte ji odtud.');
    });
  }
  function soustredeni(zapnout = !document.body.classList.contains('soustredeni')) {
    document.body.classList.toggle('soustredeni', zapnout);
    $('ven').hidden = !zapnout;
    $('tlCelaObr').setAttribute('aria-pressed', String(zapnout));
    if (zapnout) celaObrazovka();
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
    if (bloky.length) { const b = aktualniBlok(); requestAnimationFrame(() => skocNaBlok(b, false)); }
  }
  $('ven').onclick = () => soustredeni(false);
  const poZmeneCeleObr = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement && document.body.classList.contains('soustredeni')) soustredeni(false); };
  document.addEventListener('fullscreenchange', poZmeneCeleObr);
  document.addEventListener('webkitfullscreenchange', poZmeneCeleObr);

  /* ---------- čas čtení ---------- */
  let posledniAktivita = Date.now();
  function aktivita() { posledniAktivita = Date.now(); }
  ['keydown', 'pointerdown', 'wheel'].forEach(t => addEventListener(t, aktivita, { passive: true }));
  const dnes = () => new Date().toLocaleDateString('sv');   // RRRR-MM-DD
  setInterval(() => {
    const cte = (tts.aktivni && !tts.pauza) || Date.now() - posledniAktivita < 120000;
    if (document.visibilityState !== 'visible' || !cte || !kniha) return;
    stav.cas += 15;
    stav.dny[dnes()] = (stav.dny[dnes()] || 0) + 15;
    const dny = Object.keys(stav.dny).sort();
    while (dny.length > 400) delete stav.dny[dny.shift()];
    ulozStav();
  }, 15000);

  function ukazStatistiky() {
    const t = s => s < 60 ? '0 min' : J.formatCas(s / 60);
    const tyden = Object.entries(stav.dny).filter(([d]) => (Date.now() - new Date(d)) / 864e5 < 7).reduce((s, [, v]) => s + v, 0);
    let h = `<table><tr><td>Celkový čas čtení</td><td>${t(stav.cas)}</td></tr><tr><td>Dnes</td><td>${t(stav.dny[dnes()] || 0)}</td></tr>
      <tr><td>Posledních 7 dní</td><td>${t(tyden)}</td></tr><tr><td>Dní se čtením</td><td>${Object.keys(stav.dny).length}</td></tr>`;
    knihy.forEach(k => {
      const prec = Object.keys(stav.precteno[k.id] || {}).length, p = pokrokKnihy(k);
      h += `<tr><td><strong>${J.esc(k.nazev)}</strong></td><td>${Math.floor(p * 100)} % · ${prec}/${k.kapitoly.length} kapitol · zbývá ~${J.formatCas(k.slov * (1 - p) / nast().wpm)}</td></tr>`;
    });
    h += `<tr><td>Záložky</td><td>${data.zalozky.length}</td></tr><tr><td>Zvýraznění / s poznámkou</td><td>${data.zvyrazneni.length} / ${data.zvyrazneni.filter(z => z.poznamka).length}</td></tr></table>`;
    $('statObsah').innerHTML = h;
    $('wpm').value = nast().wpm;
    otevriModal('statistiky');
  }
  $('wpm').addEventListener('change', e => { const v = Math.round(+e.target.value); if (v >= 80 && v <= 600) { nast().wpm = v; ulozStav(); poScrollu(); ukazStatistiky(); } });

  /* ---------- export, tisk, offline, záloha ---------- */
  const souborNazev = k => 'Kroniky_vyhnanstvi_' + J.normalizuj(k.nazev).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  function stahni(jmeno, obsah, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
    a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportKnihy(format) {
    try {
      const obsahy = await nactiKnihu(kniha);
      if (format === 'epub' || format === 'mobi') {
        Dialog.info('Připravuji e-knihu s ilustracemi…');
        const kapitoly = kniha.kapitoly.map((c, i) => ({ nazev: c.nazev, bloky: obsahy[i].bloky }));
        const obrazky = await jpegyKnihy(kniha, kapitoly, format === 'mobi' ? 120000 : 400000);
        if (format === 'epub') stahni(souborNazev(kniha) + '.epub', J.epub(kniha, kapitoly, obrazky), 'application/epub+zip');
        else stahni(souborNazev(kniha) + '.mobi', J.mobi(kniha, kapitoly, obrazky), 'application/x-mobipocket-ebook');
      } else {
        const md = `# Kroniky vyhnanství – ${kniha.nazev}\n\n_${kniha.podtitul}_\n\n` + obsahy.map(o => o.md.replace(/^# /, '## ')).join('\n\n');
        stahni(souborNazev(kniha) + '.md', md, 'text/markdown;charset=utf-8');
      }
    } catch (e) { Dialog.chyba('Knihu se nepodařilo načíst celou. Jste offline?'); }
  }
  // ilustrace pro e-knihy jako JPEG (WebP starší čtečky neumí, MOBI má limit ~127 kB na obrázek)
  async function jpegyKnihy(k, kapitoly, maxBajtu) {
    const srcs = new Set(k.obalka ? [k.obalka] : []);
    kapitoly.forEach(c => c.bloky.forEach(b => { if (b.typ === 'img') srcs.add(b.src); }));
    const vysl = {};
    for (const src of srcs) {
      try {
        const bmp = await createImageBitmap(await (await fetch(sOtiskem(k, src))).blob());
        let sirka = Math.min(bmp.width, 1000), kvalita = 0.82, data;
        do {
          const c = document.createElement('canvas');
          c.width = sirka; c.height = Math.round(bmp.height * sirka / bmp.width);
          const g = c.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(bmp, 0, 0, c.width, c.height);
          data = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', kvalita))).arrayBuffer());
          if (kvalita > 0.5) kvalita -= 0.1; else sirka = Math.round(sirka * 0.8);
        } while (data.length > maxBajtu && sirka > 200);
        vysl[src] = data;
      } catch (e) { /* chybějící obrázek e-knihu nezastaví */ }
    }
    return vysl;
  }
  const mojeBalik = () => J.balikPoznamek(stav.jmeno, data);
  const jmenoSouboru = (pripona) => `Kroniky_poznamky${stav.jmeno ? '_' + J.normalizuj(stav.jmeno).replace(/[^a-z0-9]+/gi, '_') : ''}_${dnes()}.${pripona}`;
  const exportPoznamek = () => stahni(jmenoSouboru('md'), J.poznamkyMd(mojeBalik(), knihy), 'text/markdown;charset=utf-8');
  const exportPoznamekJson = () => stahni(jmenoSouboru('json'), JSON.stringify(mojeBalik(), null, 1), 'application/json');
  // čtenář pošle poznámky autorovi: telefon → sdílení souboru (e-mail, zprávy…), jinak stažení + předvyplněný e-mail
  async function odeslatPoznamky() {
    if (!data.zvyrazneni.length && !data.zalozky.length) { Dialog.info('Zatím nemáte žádné poznámky ani záložky.'); return; }
    const jm = await Dialog.zeptej('Vaše jméno – podle něj autor pozná, od koho poznámky jsou:', stav.jmeno || '', { ok: 'Pokračovat' });
    if (jm === null) return;
    stav.jmeno = jm.trim(); ulozStav(true);
    const nazev = jmenoSouboru('md'), md = J.poznamkyMd(mojeBalik(), knihy);
    const predmet = `Kroniky vyhnanství – poznámky${stav.jmeno ? ' od ' + stav.jmeno : ''}`;
    const soubor = new File([md], nazev, { type: 'text/markdown' });
    if (navigator.canShare && navigator.canShare({ files: [soubor] })) {
      try { await navigator.share({ files: [soubor], title: predmet, text: predmet }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    stahni(nazev, md, 'text/markdown;charset=utf-8');
    const telo = `Dobrý den,\n\nposílám poznámky ke Kronikám vyhnanství. Soubor ${nazev} je v příloze (najdete ho ve Stažených souborech).\n\n${stav.jmeno}`;
    if (await Dialog.potvrd(`Soubor ${nazev} je stažený ve Stažených souborech. Otevřít e-mail${stav.prijemce ? ' pro ' + stav.prijemce : ''}? Soubor do něj přiložte (přetáhněte).`, { ok: '✉ Otevřít e-mail', zrus: 'Ne, pošlu sám' }))
      location.href = `mailto:${encodeURIComponent(stav.prijemce || '')}?subject=${encodeURIComponent(predmet)}&body=${encodeURIComponent(telo)}`;
  }
  // autor načte poznámky od betačtenářů (MD i JSON, víc souborů); stejné jméno = novější verze nahradí starší
  async function nactiPoznamky(soubory) {
    let nacteno = 0;
    for (const f of soubory) {
      const b = J.prectiPoznamky(await f.text());
      if (!b) { Dialog.chyba(`${f.name}: soubor neobsahuje poznámky z čtečky Kronik.`); continue; }
      const jmeno = b.jmeno || f.name.replace(/\.[a-z]+$/i, '');
      const stara = data.cizi.find(c => c.jmeno === jmeno);
      const sada = { id: stara ? stara.id : noveId(), jmeno, cas: b.cas || Date.now(), skryta: false, zvyrazneni: b.zvyrazneni, zalozky: b.zalozky };
      data.cizi = stara ? data.cizi.map(c => c === stara ? sada : c) : [...data.cizi, sada];
      nacteno++;
      Dialog.info(`${stara ? 'Aktualizováno' : 'Načteno'}: ${jmeno} – ${b.zvyrazneni.length} poznámek, ${b.zalozky.length} záložek`);
    }
    if (!nacteno) return;
    ulozData(); prekresliText(); otevriPanel('poznamky');
  }
  $('souborPoznamky').onchange = e => { if (e.target.files.length) nactiPoznamky([...e.target.files]); e.target.value = ''; };
  function prekresliText() { if (kniha) bloky.forEach((b, i) => { if (b.typ === 'p' || b.typ === 'h') vyznacBlok(i); }); }
  async function ukazCizi(sadaId, id) {
    const c = data.cizi.find(x => x.id === sadaId), z = c && c.zvyrazneni.find(x => x.id === id);
    if (!z) return;
    if (await Dialog.potvrd(`👤 ${c.jmeno || 'Čtenář'}\n\n„${z.text}“${z.poznamka ? '\n\n📝 ' + z.poznamka : ''}`, { ok: 'Zavřít', zrus: 'Seznam poznámek' })) return;
    otevriPanel('poznamky');
    const el = panelObsah.querySelector(`[data-pozn="${CSS.escape(id)}"]`);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('blik'); setTimeout(() => el.classList.remove('blik'), 1600); }
  }
  const adresaCtecky = () => { try { if (window.top !== window) return top.location.origin + top.location.pathname + '#obsah/kroniky.html'; } catch (e) {} return location.origin + location.pathname; };
  async function odkazBeta() {
    const em = await Dialog.zeptej('Odkaz pro betačtenáře. Na jaký e-mail mají poslat poznámky?', stav.prijemce || '', { ok: 'Kopírovat odkaz' });
    if (em === null) return;
    stav.prijemce = em.trim(); ulozStav(true);
    const p = 'beta=1' + (stav.prijemce ? '&email=' + encodeURIComponent(stav.prijemce) : '');
    const url = adresaCtecky();
    kopiruj(url + '?' + p, '🔗 Odkaz pro betačtenáře zkopírován');
  }
  // tisk celé knihy dělá samostatná stránka Sazba knihy (obsah/sazba.html): obálka, obsah s čísly stran, záhlaví, okraje v mm
  const sazba = (kapitola) => window.open(`sazba.html?kroniky=${encodeURIComponent(kniha.id)}` + (kapitola == null ? '' : `&kapitola=${kapitola}`), '_blank');
  async function offline() {
    Dialog.info('Ukládám kapitoly…');
    try {
      for (const k of knihy) await nactiKnihu(k);
      Dialog.info(navigator.serviceWorker && navigator.serviceWorker.controller
        ? `📥 Uloženo ${knihy.reduce((s, k) => s + k.kapitoly.length, 0)} kapitol – knihy jdou číst i bez internetu.`
        : 'Kapitoly jsou načtené, ale offline mezipaměť webu tu není aktivní (otevřete čtečku přes rozcestník webu).');
    } catch (e) { Dialog.chyba('Některé kapitoly se nepodařilo stáhnout.'); }
  }
  function odkaz() {
    const p = `kniha=${stav.kniha + 1}&kap=${encodeURIComponent(kap().soubor.replace(/\.md$/, ''))}&blok=${aktualniBlok()}`;
    let url;
    try { url = window.top !== window ? top.location.origin + top.location.pathname + '#obsah/kroniky.html?' + p : null; } catch (e) { url = null; }
    kopiruj(url || location.origin + location.pathname + '?' + p, '🔗 Odkaz zkopírován');
  }
  async function obnova(soubor) {
    try {
      const z = JSON.parse(await soubor.text());
      if (z.format !== 'kroniky-zaloha') throw new Error();
      if (!(await Dialog.potvrd('Nahradit současné poznámky, záložky a pokrok obsahem zálohy?'))) return;
      stav = { ...stav, ...z.stav, nast: { ...VYCHOZI_NAST, ...z.stav.nast } };
      data = { zalozky: [], zvyrazneni: [], cizi: [], ...z.data };
      ulozStav(true); ulozData(); pouzijNastaveni(); obnovPozici();
      Dialog.info('Záloha obnovena');
    } catch (e) { Dialog.chyba('Soubor není záloha čtečky Kronik.'); }
  }
  $('souborObnova').onchange = e => { if (e.target.files[0]) obnova(e.target.files[0]); e.target.value = ''; };

  /* ---------- okna a nabídky ---------- */
  function otevriModal(id) { $(id).hidden = false; $(id).querySelector('[data-zavrit]').focus(); }
  const otevrenyModal = () => document.querySelector('.modal:not([hidden])');
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-zavrit]')) m.hidden = true; }));

  function vykresliNabKniha() {
    $('nabKniha').innerHTML = '<div class="titulek">Kniha</div>' + knihy.map((k, i) =>
      `<button class="tl prep" data-prikaz="kniha-${i}" aria-pressed="${kniha && k.id === kniha.id}">${J.esc(k.nazev)}<span class="procento">${Math.floor(pokrokKnihy(k) * 100)} %</span></button>`).join('') +
      '<hr><button class="tl" data-prikaz="panel-obsah">☰ Obsah knihy <kbd>T</kbd></button><button class="tl" data-prikaz="od-zacatku">⏮ Číst tuto knihu od začátku</button>';
  }
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    if (n.id === 'nabKniha') vykresliNabKniha();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));

  const PRIKAZY = {
    predchozi: () => posun(-1),
    dalsi: () => posun(1),
    'od-zacatku': () => otevri(stav.kniha, 0),
    'panel-obsah': () => prepniPanel('obsah'),
    'panel-zalozky': () => prepniPanel('zalozky'),
    'panel-poznamky': () => prepniPanel('poznamky'),
    zalozka: prepniZalozku,
    predcitat: spustTts,
    soustredeni: () => soustredeni(),
    blok: () => nastav({ blok: !nast().blok }),
    knizni: () => nastav({ knizni: !nast().knizni }),
    obrazky: () => nastav({ obrazky: !nast().obrazky }),
    nezhasinat: () => nastav({ nezhasinat: !nast().nezhasinat }),
    'vychozi-zobrazeni': () => nastav({ ...VYCHOZI_NAST, wpm: nast().wpm, tts: nast().tts, hlas: nast().hlas }),
    odkaz,
    epub: () => exportKnihy('epub'),
    markdown: () => exportKnihy('md'),
    mobi: () => exportKnihy('mobi'),
    'exp-poznamky': exportPoznamek,
    'exp-poznamky-json': exportPoznamekJson,
    'odeslat-poznamky': odeslatPoznamky,
    'nacist-poznamky': () => $('souborPoznamky').click(),
    'odkaz-beta': odkazBeta,
    'tisk-kapitoly': () => print(),
    'tisk-knihy': () => sazba(),
    'sazba-kapitoly': () => sazba(kapIdx),
    offline,
    statistiky: ukazStatistiky,
    napoveda: () => otevriModal('napoveda'),
    zaloha: () => stahni(`Kroniky_vyhnanstvi_zaloha_${dnes()}.json`, JSON.stringify({ format: 'kroniky-zaloha', verze: 1, stav, data }, null, 1), 'application/json'),
    obnova: () => $('souborObnova').click(),
    'smazat-data': async () => {
      if (!(await Dialog.potvrd('Smazat všechny záložky, zvýraznění, poznámky, pokrok a statistiky čtení? Vzhled čtečky zůstane.'))) return;
      stav = { kniha: stav.kniha, pozice: {}, precteno: {}, cas: 0, dny: {}, panel: stav.panel, nast: stav.nast, jmeno: stav.jmeno, prijemce: stav.prijemce };
      data = { zalozky: [], zvyrazneni: [], cizi: data.cizi };
      ulozStav(true); ulozData(); otevri(stav.kniha, 0);
    },
  };
  function prikaz(id) {
    zavriNabidky();
    if (PRIKAZY[id]) return PRIKAZY[id]();
    const [co, hodnota] = id.split('-');
    if (co === 'kniha') { const k = knihy[+hodnota], p = stav.pozice[k.id], c = p ? Math.max(0, indexKap(k, p.soubor)) : 0; otevri(+hodnota, c, p && c === indexKap(k, p.soubor) ? p.blok : 0); }
    if (co === 'motiv') nastav({ motiv: hodnota });
    if (co === 'pismo') nastav({ pismo: hodnota });
    if (co === 'bublina') nastav({ bublina: hodnota });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { e.stopPropagation(); return prikaz(b.dataset.prikaz); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    if (!e.target.closest('#vyber, mark.zv') && getSelection().isCollapsed) zavriVyber();
    // na úzkém displeji panel překrývá text – klepnutí vedle ho zavře
    if (stav.panel && matchMedia('(max-width:760px)').matches && !e.target.closest('aside, .lista, .nabidka, .modal, dialog, #vyber')) zavriPanel();
  });
  addEventListener('resize', () => { zavriNabidky(); zavriVyber(); });

  /* ---------- klávesnice ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('lupa').hidden) { $('lupa').hidden = true; return; }
      if (otevrenyModal()) { otevrenyModal().hidden = true; return; }
      if (!lista.hidden) { zavriVyber(); return; }
      if (document.querySelector('.nabidka:not([hidden])')) { zavriNabidky(); return; }
      if (document.body.classList.contains('soustredeni')) { soustredeni(false); return; }
      if (tts.aktivni) { zastavTts(); return; }
      if (stav.panel && matchMedia('(max-width:760px)').matches) zavriPanel();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); $('hledat').focus(); $('hledat').select(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || otevrenyModal() || document.querySelector('dialog[open]')) return;
    const cil = e.target.closest ? e.target : document.body;
    if (cil.closest('input, textarea, select, [contenteditable]')) return;
    if ((e.key === ' ' || e.key === 'Enter') && cil.closest('button, [role=button]')) return;
    const vyska = plocha.clientHeight * 0.9;
    const akce = {
      ArrowLeft: () => posun(-1), ArrowRight: () => posun(1),
      ArrowDown: () => plocha.scrollBy({ top: 60 }), ArrowUp: () => plocha.scrollBy({ top: -60 }),
      PageDown: () => plocha.scrollBy({ top: vyska }), PageUp: () => plocha.scrollBy({ top: -vyska }),
      ' ': () => plocha.scrollBy({ top: e.shiftKey ? -vyska : vyska }),
      Home: () => plocha.scrollTo({ top: 0 }), End: () => plocha.scrollTo({ top: plocha.scrollHeight }),
      '/': () => { $('hledat').focus(); $('hledat').select(); },
      t: () => prepniPanel('obsah'), b: prepniZalozku, z: () => prepniPanel('zalozky'), n: () => prepniPanel('poznamky'),
      r: spustTts, f: () => soustredeni(),
      '+': () => nastav({ velikost: Math.min(1.8, +(nast().velikost + 0.05).toFixed(2)) }),
      '=': () => nastav({ velikost: Math.min(1.8, +(nast().velikost + 0.05).toFixed(2)) }),
      '-': () => nastav({ velikost: Math.max(0.8, +(nast().velikost - 0.05).toFixed(2)) }),
      '?': () => otevriModal('napoveda'), F1: () => otevriModal('napoveda'),
    }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (akce) { e.preventDefault(); akce(); }
  });

  /* ---------- posuvník kapitoly ---------- */
  const posuvnik = $('posuvnik'), jezdec = $('jezdec'), bublina = $('bublina'), drazka = posuvnik.querySelector('.drazka');
  let casBubliny = 0, tazeni = false;
  function kresliPosuvnik() {
    const max = plocha.scrollHeight - plocha.clientHeight, h = drazka.clientHeight;
    const vyska = Math.max(28, h * plocha.clientHeight / Math.max(1, plocha.scrollHeight));
    const podil = max > 0 ? plocha.scrollTop / max : 0;
    jezdec.style.height = vyska + 'px';
    jezdec.style.top = (podil * (h - vyska)) + 'px';
    if (!kniha) return;
    const zbyva = (kap().slov - (kum[aktualniBlok()] || 0)) / nast().wpm;
    // nastavení: u posuvníku (sleduje jezdec), dole v okně (neruší text), nebo vůbec
    const kde = nast().bublina || 'dole';
    if (kde === 'ne') return;
    bublina.textContent = `${Math.round(podil * 100)} % kapitoly · zbývá ~${J.formatCas(zbyva)}`;
    bublina.classList.toggle('dole', kde === 'dole');
    bublina.style.top = kde === 'dole' ? '' : (8 + podil * (h - vyska) + vyska / 2) + 'px';
    bublina.classList.remove('skryt');
    clearTimeout(casBubliny);
    if (!tazeni) casBubliny = setTimeout(() => bublina.classList.add('skryt'), 1200);
  }
  // značky záložek a zvýraznění podél posuvníku
  let ramecZnacek = 0;
  function planujZnacky() { if (!ramecZnacek) ramecZnacek = requestAnimationFrame(kresliZnacky); }
  function kresliZnacky() {
    ramecZnacek = 0;
    const vyska = Math.max(1, plocha.scrollHeight), h = drazka.clientHeight;
    $('znacky').innerHTML = [...text.querySelectorAll('mark.zal-slovo, mark.zv')].map(el => {
      const top = (el.closest('[data-i]').offsetTop + el.offsetTop) / vyska * h;
      return el.classList.contains('zv') ? `<div class="znacka" style="top:${top.toFixed(1)}px;background:var(--zv-${el.dataset.barva})"></div>`
        : `<div class="znacka zal" style="top:${top.toFixed(1)}px"></div>`;
    }).join('');
    kresliPosuvnik();
  }
  function posunNa(e) {
    const r = drazka.getBoundingClientRect(), vyska = jezdec.offsetHeight;
    const podil = Math.min(1, Math.max(0, (e.clientY - r.top - vyska / 2) / Math.max(1, r.height - vyska)));
    plocha.scrollTop = podil * (plocha.scrollHeight - plocha.clientHeight);
  }
  posuvnik.addEventListener('pointerdown', e => {
    tazeni = true; posuvnik.classList.add('tazeni'); posuvnik.setPointerCapture(e.pointerId); posunNa(e); e.preventDefault();
  });
  posuvnik.addEventListener('pointermove', e => { if (tazeni) posunNa(e); });
  const konecTazeni = () => { if (!tazeni) return; tazeni = false; posuvnik.classList.remove('tazeni'); kresliPosuvnik(); };
  posuvnik.addEventListener('pointerup', konecTazeni);
  posuvnik.addEventListener('pointercancel', konecTazeni);
  new ResizeObserver(planujZnacky).observe(text);   // dorazily obrázky, změna písma, šířky…

  /* ---------- lupa na ilustrace ---------- */
  text.addEventListener('click', e => {
    const img = e.target.closest('figure img');
    if (!img) return;
    $('lupa').querySelector('img').src = img.src;
    $('lupa').querySelector('img').alt = img.alt;
    $('lupa').hidden = false;
  });
  $('lupa').onclick = () => { $('lupa').hidden = true; };

  /* ---------- start ---------- */
  function obnovPozici() {
    const q = new URLSearchParams(location.search);
    let k = Math.min(knihy.length - 1, Math.max(0, stav.kniha | 0)), c = 0, b = 0;
    if (q.get('kniha') && knihy[q.get('kniha') - 1]) {
      k = q.get('kniha') - 1;
      const kapQ = q.get('kap');
      if (kapQ) { c = Math.max(0, knihy[k].kapitoly.findIndex(x => x.soubor === kapQ + '.md' || x.soubor === kapQ)); b = +q.get('blok') || 0; }
      else { const p = stav.pozice[knihy[k].id]; if (p) { c = Math.max(0, indexKap(knihy[k], p.soubor)); b = p.blok; } }
    } else if (typeof stav.staraKapitola === 'number') {
      c = Math.min(stav.staraKapitola, knihy[k].kapitoly.length - 1); delete stav.staraKapitola;
    } else {
      const p = stav.pozice[knihy[k].id];
      if (p && indexKap(knihy[k], p.soubor) >= 0) { c = indexKap(knihy[k], p.soubor); b = p.blok; }
    }
    return otevri(k, c, b);
  }
  pouzijNastaveni();
  const dotazUrl = new URLSearchParams(location.search);
  if (dotazUrl.has('beta')) {
    if (dotazUrl.get('email')) stav.prijemce = dotazUrl.get('email');
    if (!stav.betaNavod) {
      stav.betaNavod = true;
      Dialog.potvrd('Vítejte u betačtení Kronik vyhnanství.\n\nKdyž vás něco zarazí, označte v textu pár slov a vyberte barvu nebo 📝 a napište poznámku. Poznámky se ukládají jen ve vašem prohlížeči.\n\nAž budete chtít poslat poznámky autorovi, otevřete panel 📝 Poznámky (klávesa N) a klepněte na 📤 Odeslat autorovi.', { ok: 'Rozumím', zrus: 'Zavřít' });
    }
    ulozStav(true);
  }
  if (stav.panel && matchMedia('(max-width:760px)').matches) stav.panel = null;
  await obnovPozici();
  if (stav.panel) otevriPanel(stav.panel);
  // písmo a rozložení se můžou dopočítat až po prvním vykreslení – znovu dojet na uložené místo
  addEventListener('load', () => { const p = kniha && stav.pozice[kniha.id]; if (p && p.soubor === kap().soubor && p.blok) skocNaBlok(p.blok, false); });
  window.KRONIKY_CTECKA = { otevri, skok, hledej, stav: () => stav, data: () => data, aktualniBlok, tts };
})();
