/* Kroniky vyhnanství – čtečka (UI nad KRONIKY_JADRO).
   localStorage: webapp_kroniky (nastavení, pozice, pokrok, čas čtení),
                 webapp_kroniky_poznamky (záložky a zvýraznění). */
(async () => {
  'use strict';
  const J = window.KRONIKY_JADRO;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_kroniky', KLIC_P = 'webapp_kroniky_poznamky';
  const plocha = $('plocha'), text = $('text');
  if (window.top === window) document.body.classList.add('samostatne');

  /* ---------- uložená data ---------- */
  const VYCHOZI_NAST = { motiv: 'web', pismo: 'patkove', velikost: 1, radkovani: 1.7, sirka: 36, blok: true, knizni: false, wpm: 220, tts: 1, hlas: '' };
  const cti = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  let stav = cti(KLIC);
  // starší verze čtečky ukládala jen {kniha, kapitola, velikost}
  if (typeof stav.kapitola === 'number') stav = { kniha: stav.kniha, staraKapitola: stav.kapitola, nast: { velikost: stav.velikost } };
  stav = { kniha: 0, pozice: {}, precteno: {}, cas: 0, dny: {}, panel: null, ...stav };
  stav.nast = { ...VYCHOZI_NAST, ...stav.nast };
  let data = { zalozky: [], zvyrazneni: [], ...cti(KLIC_P) };
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
  const knihy = await (await fetch('kroniky/knihy.json')).json();
  knihy.forEach(k => { k.slov = k.kapitoly.reduce((s, c) => s + c.slov, 0); });
  const mezipamet = new Map();
  function nactiKapitolu(kniha, soubor) {
    const klic = kniha.id + '/' + soubor;
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
    s.setProperty('--sirka', n.sirka + 'rem');
    s.setProperty('--pismo', PISMA[n.pismo] || PISMA.patkove);
    text.classList.toggle('blok', n.blok);
    text.classList.toggle('knizni', n.knizni);
    $('rVelikost').value = n.velikost; $('oVelikost').value = Math.round(n.velikost * 100) + ' %';
    $('rRadkovani').value = n.radkovani; $('oRadkovani').value = n.radkovani.toFixed(1);
    $('rSirka').value = n.sirka; $('oSirka').value = n.sirka + ' em';
    document.querySelectorAll('#nabZobrazeni .prep').forEach(b => {
      const [co, hodnota] = b.dataset.prikaz.split('-');
      b.setAttribute('aria-pressed', String(co === 'motiv' ? n.motiv === hodnota : co === 'pismo' ? n.pismo === hodnota : !!n[co]));
    });
    if (bloky.length) skocNaBlok(blok, false);
    ulozStav();
  }
  const nastav = zmena => { Object.assign(stav.nast, zmena); pouzijNastaveni(); };
  [['rVelikost', 'velikost'], ['rRadkovani', 'radkovani'], ['rSirka', 'sirka']].forEach(([id, klic]) =>
    $(id).addEventListener('input', e => nastav({ [klic]: +e.target.value })));

  /* ---------- vykreslení kapitoly ---------- */
  const htmlBloku = (b, i) => b.typ === 'hr' ? `<hr data-i="${i}">`
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
    text.innerHTML = bloky.map(htmlBloku).join('');
    bloky.forEach((b, i) => { if (b.typ !== 'hr') vyznacBlok(i); });
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
    const maZalozku = data.zalozky.some(z => z.kniha === kniha.id && z.soubor === kap().soubor && z.blok === i);
    $('tlZalozka').setAttribute('aria-pressed', String(maZalozku));
    ulozStav();
  }
  plocha.addEventListener('scroll', () => { aktivita(); if (!ramec) ramec = requestAnimationFrame(poScrollu); }, { passive: true });

  const posun = smer => {
    let k = stav.kniha, c = kapIdx + smer;
    if (c < 0) { k--; if (k < 0) return; c = knihy[k].kapitoly.length - 1; }
    if (c >= knihy[k].kapitoly.length) { k++; if (k >= knihy.length) return; c = 0; }
    otevri(k, c);
  };

  async function skok(knihaId, soubor, blok, hledany) {
    const k = knihy.findIndex(x => x.id === knihaId), c = k < 0 ? -1 : indexKap(knihy[k], soubor);
    if (c < 0) { Dialog.chyba('Toto místo už v knize není.'); return; }
    if (k !== stav.kniha || c !== kapIdx) await otevri(k, c, blok);
    if (hledany) vyznacBlok(blok, hledany);
    const el = prvekBloku(blok);
    if (el) {
      skocNaBlok(blok);
      el.classList.add('blik');
      setTimeout(() => el.classList.remove('blik'), 1600);
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

  function vyznacBlok(i, hledany) {
    const el = prvekBloku(i), b = bloky[i];
    if (!el || !b || b.typ === 'hr') return;
    el.innerHTML = J.inline(b.md);
    const soubor = kap().soubor;
    el.classList.toggle('zalozka', data.zalozky.some(z => z.kniha === kniha.id && z.soubor === soubor && z.blok === i));
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
    if (hledany) {
      const t = J.normalizuj(b.text), q = J.normalizuj(hledany);
      const pozice = [];
      for (let p = t.indexOf(q); p >= 0 && q; p = t.indexOf(q, p + q.length)) pozice.push(p);
      pozice.reverse().forEach(p => obal(el, p, p + q.length, () => Object.assign(document.createElement('mark'), { className: 'nalez' })));
    }
  }

  function prepniZalozku() {
    if (!kniha) return;
    const i = aktualniBlok(), soubor = kap().soubor;
    const idx = data.zalozky.findIndex(z => z.kniha === kniha.id && z.soubor === soubor && z.blok === i);
    if (idx >= 0) { data.zalozky.splice(idx, 1); Dialog.info('Záložka odebrána'); }
    else {
      const ukazka = bloky[i].text.slice(0, 110) + (bloky[i].text.length > 110 ? '…' : '');
      data.zalozky.push({ id: noveId(), kniha: kniha.id, soubor, blok: i, ukazka, cas: Date.now() });
      Dialog.info('🔖 Záložka přidána');
    }
    ulozData(); vyznacBlok(i); poScrollu();
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
      if (!el || el !== blokZUzlu(r.endContainer) || el.tagName === 'HR') { if (vyber && vyber.rezim === 'novy') zavriVyber(); return; }
      const od = offsetV(el, r.startContainer, r.startOffset), do_ = offsetV(el, r.endContainer, r.endOffset);
      const i = +el.dataset.i, t = bloky[i].text.slice(od, do_);
      if (!t.trim()) return;
      vyber = { rezim: 'novy', blok: i, od, do: do_, text: t };
      ukazListu(r.getBoundingClientRect());
    }, 180);
  });
  text.addEventListener('click', e => {
    const m = e.target.closest('mark.zv');
    if (!m || !getSelection().isCollapsed) return;
    vyber = { rezim: 'uprava', id: m.dataset.id };
    ukazListu(m.getBoundingClientRect());
  });
  lista.addEventListener('pointerdown', e => e.preventDefault());   // výběr nezmizí kliknutím do lišty
  lista.addEventListener('click', async e => {
    const tl = e.target.closest('button');
    if (!tl || !vyber) return;
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
  const skokAttr = (x, hledany) => `data-skok="${x.kniha}|${x.soubor || x.kap}|${x.blok}"${hledany ? ` data-hledany="${J.esc(hledany)}"` : ''}`;

  let vysledky = null, dotaz = '';
  function vykresliPanel() {
    panel.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.karta === stav.panel)));
    $('tlObsah').setAttribute('aria-pressed', String(stav.panel === 'obsah'));
    const e = J.esc;
    let h = '';
    if (stav.panel === 'obsah') {
      knihy.forEach((k, ki) => {
        h += `<h3>${e(k.nazev)} · ${Math.floor(pokrokKnihy(k) * 100)} %</h3>`;
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
      h = z.length ? '' : '<p class="prazdne">Zatím žádné záložky. Tlačítkem 🔖 nebo klávesou B si označíte odstavec, který je právě nahoře.</p>';
      z.forEach(x => {
        h += `<div class="polozka pozn" role="button" tabindex="0" ${skokAttr(x)}><small>${e(knihaPodleId(x.kniha)?.nazev || '')} · ${e(nazevKap(x))} · ${datum(x.cas)}</small><span>${e(x.ukazka)}</span>
          <span class="panel-akce"><button class="tl" data-smaz-z="${x.id}">✕ Odebrat</button></span></div>`;
      });
    } else if (stav.panel === 'poznamky') {
      const z = [...data.zvyrazneni].sort(podlePoradi);
      h = `<div class="panel-akce"><button class="tl" data-prikaz="exp-poznamky">⬇ Export (Markdown)</button></div>`;
      if (!z.length) h += '<p class="prazdne">Zatím žádné poznámky. Označte v textu pár slov a vyberte barvu nebo 📝.</p>';
      let skupina = '';
      z.forEach(x => {
        const s = x.kniha + x.soubor;
        if (s !== skupina) { skupina = s; h += `<h3>${e(knihaPodleId(x.kniha)?.nazev || '')} – ${e(nazevKap(x))}</h3>`; }
        h += `<div class="polozka pozn" role="button" tabindex="0" ${skokAttr(x)} style="border-left:4px solid var(--zv-${x.barva})"><q>${e(x.text)}</q>${x.poznamka ? `<span class="text-pozn">📝 ${e(x.poznamka)}</span>` : ''}
          <span class="panel-akce"><button class="tl" data-uprav-p="${x.id}">📝 Poznámka</button><button class="tl" data-smaz-p="${x.id}">✕ Smazat</button></span></div>`;
      });
    }
    panelObsah.innerHTML = h;
    const akt = panelObsah.querySelector('.aktivni');
    if (akt) akt.scrollIntoView({ block: 'center' });
  }
  document.body.style.cssText += ';--zv-zluta:#ffd54f;--zv-zelena:#81c784;--zv-modra:#64b5f6;--zv-ruzova:#f06292';

  panelObsah.addEventListener('click', async e => {
    const t = e.target.closest('[data-kap],[data-skok],[data-smaz-z],[data-smaz-p],[data-uprav-p]');
    if (!t) return;
    if (t.dataset.smazZ) {
      data.zalozky = data.zalozky.filter(z => z.id !== t.dataset.smazZ);
      ulozData(); vykresliPanel(); if (kniha) { text.querySelectorAll('.zalozka').forEach(el => vyznacBlok(+el.dataset.i)); poScrollu(); }
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
    skok(k, soubor, +blok, t.dataset.hledany);
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
    while (tts.blok < bloky.length && bloky[tts.blok].typ === 'hr') tts.blok++;
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
    if (!hlasy().some(x => /^cs/i.test(x.lang))) Dialog.info('Prohlížeč nemá český hlas – čte se výchozím hlasem.');
    mluv();
  }
  function pauzaTts() {
    tts.pauza = !tts.pauza;
    $('ttsPauza').textContent = tts.pauza ? '▶' : '⏸';
    if (tts.pauza) { tts.gen++; synt.cancel(); } else mluv();
  }
  function zastavTts() {
    if (!tts.aktivni) return;
    tts.aktivni = false; tts.gen++;
    synt && synt.cancel();
    $('tts').hidden = true;
    $('tlPredcitat').setAttribute('aria-pressed', 'false');
    text.querySelectorAll('.cte').forEach(el => el.classList.remove('cte'));
  }
  const ttsSkok = smer => {
    let i = tts.blok + smer;
    while (bloky[i] && bloky[i].typ === 'hr') i += smer;
    tts.blok = Math.max(0, i); tts.vi = 0; tts.vety = []; tts.pauza = false; $('ttsPauza').textContent = '⏸';
    mluv();
  };
  $('ttsPauza').onclick = pauzaTts;
  $('ttsStop').onclick = zastavTts;
  $('ttsZpet').onclick = () => ttsSkok(-1);
  $('ttsVpred').onclick = () => ttsSkok(1);
  addEventListener('pagehide', () => { synt && synt.cancel(); ulozStav(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ulozStav(true); });

  /* ---------- soustředěné čtení ---------- */
  function soustredeni(zapnout = !document.body.classList.contains('soustredeni')) {
    document.body.classList.toggle('soustredeni', zapnout);
    $('ven').hidden = !zapnout;
    if (zapnout) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (bloky.length) { const b = aktualniBlok(); requestAnimationFrame(() => skocNaBlok(b, false)); }
  }
  $('ven').onclick = () => soustredeni(false);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('soustredeni')) soustredeni(false); });

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
      if (format === 'epub') {
        stahni(souborNazev(kniha) + '.epub', J.epub(kniha, kniha.kapitoly.map((c, i) => ({ nazev: c.nazev, bloky: obsahy[i].bloky }))), 'application/epub+zip');
      } else {
        const md = `# Kroniky vyhnanství – ${kniha.nazev}\n\n_${kniha.podtitul}_\n\n` + obsahy.map(o => o.md.replace(/^# /, '## ')).join('\n\n');
        stahni(souborNazev(kniha) + '.md', md, 'text/markdown;charset=utf-8');
      }
    } catch (e) { Dialog.chyba('Knihu se nepodařilo načíst celou. Jste offline?'); }
  }
  function exportPoznamek() {
    let md = '# Kroniky vyhnanství – moje poznámky\n';
    knihy.forEach(k => {
      const z = data.zalozky.filter(x => x.kniha === k.id), v = data.zvyrazneni.filter(x => x.kniha === k.id);
      if (!z.length && !v.length) return;
      md += `\n## ${k.nazev}\n`;
      k.kapitoly.forEach(c => {
        const zz = z.filter(x => x.soubor === c.soubor).sort(podlePoradi), vv = v.filter(x => x.soubor === c.soubor).sort(podlePoradi);
        if (!zz.length && !vv.length) return;
        md += `\n### ${c.nazev}\n\n`;
        zz.forEach(x => { md += `- 🔖 ${x.ukazka}\n`; });
        if (zz.length) md += '\n';
        vv.forEach(x => { md += `> ${x.text}\n\n` + (x.poznamka ? `${x.poznamka}\n\n` : ''); });
      });
    });
    stahni('Kroniky_vyhnanstvi_poznamky.md', md, 'text/markdown;charset=utf-8');
  }
  async function tiskKnihy() {
    try {
      const obsahy = await nactiKnihu(kniha);
      $('tisk').innerHTML = `<section><h1>Kroniky vyhnanství</h1><h1>${J.esc(kniha.nazev)}</h1><p style="text-align:center">${J.esc(kniha.podtitul)}</p></section>` +
        obsahy.map(o => `<section>${o.bloky.map(htmlBloku).join('')}</section>`).join('');
      document.body.classList.add('tisk-knihy');
      addEventListener('afterprint', () => { document.body.classList.remove('tisk-knihy'); $('tisk').innerHTML = ''; }, { once: true });
      print();
    } catch (e) { Dialog.chyba('Knihu se nepodařilo načíst celou.'); }
  }
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
      data = { zalozky: [], zvyrazneni: [], ...z.data };
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
    'vychozi-zobrazeni': () => nastav({ ...VYCHOZI_NAST, wpm: nast().wpm, tts: nast().tts, hlas: nast().hlas }),
    odkaz,
    epub: () => exportKnihy('epub'),
    markdown: () => exportKnihy('md'),
    'exp-poznamky': exportPoznamek,
    'tisk-kapitoly': () => print(),
    'tisk-knihy': tiskKnihy,
    offline,
    statistiky: ukazStatistiky,
    napoveda: () => otevriModal('napoveda'),
    zaloha: () => stahni(`Kroniky_vyhnanstvi_zaloha_${dnes()}.json`, JSON.stringify({ format: 'kroniky-zaloha', verze: 1, stav, data }, null, 1), 'application/json'),
    obnova: () => $('souborObnova').click(),
    'smazat-data': async () => {
      if (!(await Dialog.potvrd('Smazat všechny záložky, zvýraznění, poznámky, pokrok a statistiky čtení? Vzhled čtečky zůstane.'))) return;
      stav = { kniha: stav.kniha, pozice: {}, precteno: {}, cas: 0, dny: {}, panel: stav.panel, nast: stav.nast };
      data = { zalozky: [], zvyrazneni: [] };
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
  if (stav.panel && matchMedia('(max-width:760px)').matches) stav.panel = null;
  await obnovPozici();
  if (stav.panel) otevriPanel(stav.panel);
  // písmo a rozložení se můžou dopočítat až po prvním vykreslení – znovu dojet na uložené místo
  addEventListener('load', () => { const p = kniha && stav.pozice[kniha.id]; if (p && p.soubor === kap().soubor && p.blok) skocNaBlok(p.blok, false); });
  window.KRONIKY_CTECKA = { otevri, skok, hledej, stav: () => stav, data: () => data, aktualniBlok, tts };
})();
