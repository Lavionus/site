/* Výpisky a citáty – rozhraní (obsah/vypisky.html). Logika je ve VYPISKY (jadro.js).
   Čte (nikdy nezapisuje): IndexedDB webapp_ctecka_knih (store meta), localStorage webapp_ctecka_knih_<id>_poznamky,
   knihy/dila.json + knihy/<dílo>/knihy.json a <klic díla>_poznamky.
   Zapisuje jen localStorage webapp_vypisky = {citaty, doplnky: {idVýpisku: {stitky, hvezda, komentar}}, nast}.
   Kontext výpisku čte text kapitoly: IndexedDB store obsah (Čtečka knih) nebo soubor kapitoly díla; rozbor = KRONIKY_JADRO.rozeber. */
(() => {
  'use strict';
  const V = window.VYPISKY;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_vypisky';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  if (window.top === window) document.body.classList.add('samostatne');

  /* ---------- vlastní úložiště ---------- */
  const VYCHOZI_KARTY = { velikost: 'vizitka', orientace: 'sirka', arch: 'a4', pismo: 'serif_i', maxPt: 0, zarovnani: 'stred', ramecek: 'linka', okraj: 0, mezera: 0, orezy: true, uvozovky: true, podpis: true };
  let ulozene;
  try { ulozene = JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { ulozene = {}; }
  const data = { citaty: Array.isArray(ulozene.citaty) ? ulozene.citaty : [], doplnky: ulozene.doplnky || {} };
  const nast = { razeni: 'nove', den: true, hvezdyNahoru: false, cizi: false, zalozky: true, ...(ulozene.nast || {}) };
  nast.karty = { ...VYCHOZI_KARTY, ...(nast.karty || {}) };
  nast.obrazek = { format: 'ctverec', motiv: 'papir', pismo: 'serif_i', ramecek: 'rohy', ...(nast.obrazek || {}) };
  function uloz() {
    try { localStorage.setItem(KLIC, JSON.stringify({ citaty: data.citaty, doplnky: data.doplnky, nast })); }
    catch (e) { Dialog.chyba('Úložiště prohlížeče je plné – změny se neuložily.'); }
  }

  /* ---------- čtení zdrojů (jen čtení!) ---------- */
  // Otevření bez verze; kdyby databáze neexistovala, upgrade se zruší – jinak bychom založili prázdnou DB bez storů a rozbili čtečku.
  // store + klic (null = vše) → výsledek čtení, při jakékoli potíži null
  function ctiCtecku(store, klic = null) {
    return new Promise(ok => {
      let r;
      try { r = indexedDB.open('webapp_ctecka_knih'); } catch (e) { ok(null); return; }
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* nic */ } };
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(store)) { db.close(); ok(null); return; }
        const s = db.transaction(store, 'readonly').objectStore(store), q = klic == null ? s.getAll() : s.get(klic);
        q.onsuccess = () => { db.close(); ok(q.result || null); };
        q.onerror = () => { db.close(); ok(null); };
      };
    });
  }
  const ctiMetaCtecky = async () => ((await ctiCtecku('meta')) || []).map(({ id, nazev, autor, kapitoly }) => ({ id, nazev, autor, kapitoly }));
  const ctiLS = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
  const ctiJson = async url => { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  let dilaCache = null;   // dila.json + knihy.json stačí stáhnout jednou
  async function nactiDila() {
    if (dilaCache) return dilaCache;
    const dila = await ctiJson('knihy/dila.json');
    if (!Array.isArray(dila)) return [];
    const ven = await Promise.all(dila.map(async d => ({ dilo: d, knihy: await ctiJson(d.data + 'knihy.json') || [] })));
    if (ven.every(x => x.knihy.length)) dilaCache = ven;
    return ven;
  }
  let vse = [], nacteno = false;
  async function nactiVse() {
    const [meta, dila] = await Promise.all([ctiMetaCtecky(), nactiDila()]);
    const ctecka = meta.map(m => ({ meta: m, poznamky: ctiLS(`webapp_ctecka_knih_${m.id}_poznamky`) })).filter(x => x.poznamky);
    const dilaP = dila.map(d => ({ ...d, poznamky: ctiLS(d.dilo.klic + '_poznamky') })).filter(x => x.poznamky);
    vse = V.sber({ ctecka, dila: dilaP, vlastni: data }, { cizi: nast.cizi });
    nacteno = true;
  }
  function prepocitej() { vse = vse.filter(p => p.druh !== 'vlastni').concat(V.sber({ vlastni: data })); }
  // štítky a hvězdy výpisků ze čteček drží položka i doplnky
  function doplnek(p) {
    if (p.druh === 'vlastni') return data.citaty.find(c => c.id === p.vlastniId);
    return data.doplnky[p.id] || (data.doplnky[p.id] = { stitky: [], hvezda: false });
  }
  function upravDoplnek(p, zmena) {
    const d = doplnek(p);
    if (!d) return;
    Object.assign(d, zmena);
    if (p.druh !== 'vlastni' && !d.hvezda && !(d.stitky || []).length && !d.komentar) delete data.doplnky[p.id];
    Object.assign(p, zmena);
    uloz();
  }

  /* ---------- stav zobrazení ---------- */
  const filtr = { hledat: '', druh: '', barva: '', kniha: '', stitek: '', jenPoznamka: false, jenHvezda: false };
  let vyber = null;   // null = režim výběru vypnutý, jinak Set id
  let limit = 200, zobrazene = [];
  let denPolozka = null, denNahodny = false;

  function filtrovane() {
    let p = vse;
    if (!nast.zalozky) p = p.filter(x => x.druh !== 'zalozka');
    return V.serad(V.filtruj(p, filtr), nast.razeni, nast.hvezdyNahoru);
  }

  // zvýraznění hledaných slov (bez diakritiky – normalizuj zachová počet znaků)
  function sHledanim(text) {
    const slova = V.rozeberDotaz(filtr.hledat).slova;
    if (!slova.length) return esc(text);
    const znaky = Array.from(text), norm = Array.from(V.normalizuj(text)).join('');
    const znac = new Array(znaky.length).fill(false);
    for (const s of slova) {
      let i = norm.indexOf(s);
      while (i >= 0) { for (let j = i; j < i + Array.from(s).length; j++) znac[j] = true; i = norm.indexOf(s, i + 1); }
    }
    let h = '', v = false;
    znaky.forEach((z, i) => {
      if (znac[i] !== v) { h += znac[i] ? '<mark>' : '</mark>'; v = znac[i]; }
      h += esc(z);
    });
    return h + (v ? '</mark>' : '');
  }

  // odkaz do čtečky: v rozcestníku přes hash horního okna (adresa zůstane sdílitelná)
  function adresa(odkaz) {
    try { if (window.top !== window && top.location.pathname) return { href: top.location.pathname + '#obsah/' + odkaz, target: '_top' }; } catch (e) { /* cizí okno */ }
    return { href: odkaz, target: '_self' };
  }
  const odkazHtml = (p, trida = 'tl mini') => {
    if (!p.odkaz) return '';
    const a = adresa(p.odkaz);
    return `<a class="${trida}" href="${esc(a.href)}" target="${a.target}" title="Otevřít v čtečce na tomto místě">📖 Otevřít v čtečce</a>`;
  };

  function polozkaHtml(p) {
    const vyb = vyber && vyber.has(p.id);
    const meta = [];
    meta.push(`<span class="druh">${esc(V.DRUHY[p.druh])}${p.barva ? `<span class="sr"> (${esc(V.BARVY[p.barva])})</span>` : ''}</span>`);
    if (p.druh === 'vlastni') {
      if (p.autor) meta.push(`<b>${esc(p.autor)}</b>`);
      if (p.kniha) meta.push(`<span>${esc(p.kniha)}</span>`);
    } else {
      meta.push(`<b>${esc(V.nazevKnihy(p))}</b>`);
      if (p.kapitola) meta.push(`<span>${esc(p.kapitola)}</span>`);
    }
    if (p.ctenar) meta.push(`<span>👤 ${esc(p.ctenar)}</span>`);
    if (p.cas) meta.push(`<span>${V.datum(p.cas)}</span>`);
    return `<article class="vyp${p.druh === 'zalozka' ? ' zalozka' : ''}${vyber ? ' s-vyberem' : ''}${vyb ? ' vybrany' : ''}" data-id="${esc(p.id)}"${p.barva ? ` style="--pruh:${V.BARVY_HEX[p.barva]}"` : ''}>
      <input type="checkbox" class="zaskrtnout" data-akce="vybrat" ${vyb ? 'checked' : ''} aria-label="Vybrat">
      <blockquote>${p.druh === 'zalozka' ? '🔖 ' : ''}${sHledanim(p.text)}</blockquote>
      ${p.poznamka ? `<div class="pozn">📝 ${sHledanim(p.poznamka)}</div>` : ''}
      ${p.komentar ? `<div class="pozn koment" title="Můj komentář (jen na této stránce)">💬 ${sHledanim(p.komentar)}</div>` : ''}
      <div class="meta">${meta.join('')}</div>
      ${p.stitky.length ? `<div class="stitky">${p.stitky.map(s => `<button class="stitek${V.normalizuj(s) === V.normalizuj(filtr.stitek) ? ' aktivni' : ''}" data-akce="stitek" data-stitek="${esc(s)}">#${esc(s)}</button>`).join('')}</div>` : ''}
      <div class="akce">
        <button class="hvezda${p.hvezda ? ' ano' : ''}" data-akce="hvezda" title="Oblíbený" aria-label="Oblíbený" aria-pressed="${p.hvezda}">${p.hvezda ? '★' : '☆'}</button>
        ${odkazHtml(p)}
        ${p.druh !== 'vlastni' ? '<button class="tl mini" data-akce="kontext" title="Celý odstavec z knihy" aria-label="Kontext v knize">📄</button>' : ''}
        <button class="tl mini" data-akce="kopirovat" title="Kopírovat citát" aria-label="Kopírovat citát">⧉</button>
        ${p.druh !== 'vlastni' ? '<button class="tl mini" data-akce="komentar" title="Můj komentář k výpisku" aria-label="Můj komentář k výpisku">💬</button>' : ''}
        <button class="tl mini" data-akce="stitky" title="Štítky" aria-label="Štítky">🏷</button>
        ${p.druh !== 'zalozka' ? '<button class="tl mini" data-akce="obrazek" title="Citát jako obrázek" aria-label="Citát jako obrázek">🖼</button><button class="tl mini" data-akce="karta" title="Kartička z tohoto citátu" aria-label="Kartička z tohoto citátu">🖨</button>' : ''}
        ${p.druh === 'vlastni' ? '<button class="tl mini" data-akce="upravit" title="Upravit" aria-label="Upravit">✎</button><button class="tl mini" data-akce="smazat" title="Smazat" aria-label="Smazat">🗑</button>' : ''}
      </div>
    </article>`;
  }

  function vykresliSeznam() {
    zobrazene = filtrovane();
    const s = $('seznam');
    if (!zobrazene.length) {
      s.innerHTML = vse.length
        ? '<div class="prazdne">Filtrům nic neodpovídá. <button class="tl" data-prikaz="zrusit-filtry">✕ Zrušit filtry</button></div>'
        : `<div class="prazdne"><p><b>Zatím tu nejsou žádné výpisky.</b></p><p>Označte v <a href="ctecka_knih.html">Čtečce knih</a> nebo v <a href="kroniky.html">Kronikách</a> kus textu a vyberte barvu nebo 📝 poznámku – objeví se tady. Nebo si zapište vlastní citát.</p><button class="tl hlavni" data-prikaz="novy">✚ Nový citát</button></div>`;
    } else {
      // řazení podle knihy: nadpisy knih a kapitol
      let h = '', kniha = null, kap = null;
      for (const p of zobrazene.slice(0, limit)) {
        if (nast.razeni === 'kniha') {
          if (p.knihaKlic !== kniha) {
            kniha = p.knihaKlic; kap = null;
            h += `<h2 class="skupina">${esc(p.druh === 'vlastni' ? (p.kniha || V.DRUHY.vlastni) : V.nazevKnihy(p))}${p.druh !== 'vlastni' && p.autor ? ` <small>${esc(p.autor)}</small>` : ''}</h2>`;
          }
          if (p.kapitola && p.kapitola !== kap) { kap = p.kapitola; h += `<h3 class="skupina-kap">${esc(kap)}</h3>`; }
        }
        h += polozkaHtml(p);
      }
      s.innerHTML = h;
    }
    $('dalsi').hidden = zobrazene.length <= limit;
    $('dalsi').textContent = `Zobrazit další (${zobrazene.length - limit})`;
    $('pocet').textContent = zobrazene.length === vse.length ? `${vse.length} výpisků` : `${zobrazene.length} z ${vse.length}`;
    vykresliVyber();
  }

  function vykresliFiltry() {
    const zaklad = nast.zalozky ? vse : vse.filter(p => p.druh !== 'zalozka');
    const pocet = f => zaklad.filter(f).length;
    const druhy = [['', 'Vše', zaklad.length], ['zvyrazneni', '🖍 Zvýraznění', pocet(p => p.druh === 'zvyrazneni')],
      ...(nast.zalozky ? [['zalozka', '🔖 Záložky', pocet(p => p.druh === 'zalozka')]] : []), ['vlastni', '✍ Vlastní citáty', pocet(p => p.druh === 'vlastni')]];
    $('fDruh').innerHTML = druhy.map(([k, n, c]) => `<button class="filtr${filtr.druh === k ? ' aktivni' : ''}" data-druh="${k}"><span class="jm">${n}</span><span class="n">${c}</span></button>`).join('');
    $('fBarva').innerHTML = `<button data-barva="" class="${filtr.barva ? '' : 'aktivni'}" title="Všechny barvy" aria-label="Všechny barvy">✱</button>`
      + Object.entries(V.BARVY).map(([k, n]) => `<button data-barva="${k}" class="${filtr.barva === k ? 'aktivni' : ''}" style="background:${V.BARVY_HEX[k]}" title="${n} (${pocet(p => p.barva === k)})" aria-label="${n}"></button>`).join('')
      + `<button data-barva="zadna" class="${filtr.barva === 'zadna' ? 'aktivni' : ''}" title="Bez barvy (záložky, vlastní citáty)" aria-label="Bez barvy">∅</button>`;
    const knihy = V.seznamKnih(zaklad);
    let h = `<button class="filtr${filtr.kniha ? '' : ' aktivni'}" data-kniha=""><span class="jm">Všechny knihy</span><span class="n">${zaklad.length}</span></button>`;
    for (const k of knihy) h += `<button class="filtr${filtr.kniha === k.klic ? ' aktivni' : ''}" data-kniha="${esc(k.klic)}" title="${esc(k.zdrojNazev + ' – ' + k.nazev)}"><span class="jm">${esc(k.nazev)}<small>${esc(k.zdrojNazev)}</small></span><span class="n">${k.n}</span></button>`;
    $('fKniha').innerHTML = h;
    const st = V.seznamStitku(zaklad);
    $('fStitky').innerHTML = st.length ? st.map(s => `<button class="stitek${V.normalizuj(filtr.stitek) === V.normalizuj(s.stitek) ? ' aktivni' : ''}" data-stitek="${esc(s.stitek)}">#${esc(s.stitek)} <span>${s.n}</span></button>`).join('')
      : '<span style="font-size:.78rem;color:var(--text-faint)">Štítky přidáte tlačítkem 🏷 u výpisku.</span>';
    $('fPoznamka').checked = filtr.jenPoznamka;
    $('fHvezda').checked = filtr.jenHvezda;
    const zv = vse.filter(p => p.druh === 'zvyrazneni').length;
    $('statistika').innerHTML = `Zvýraznění: ${zv} (s poznámkou ${vse.filter(p => p.poznamka).length})<br>Záložky: ${vse.filter(p => p.druh === 'zalozka').length}<br>Vlastní citáty: ${data.citaty.length}<br>Knihy: ${knihy.filter(k => k.zdroj !== 'vlastni').length}`;
    // nabídky pro editor
    const dl = (id, hodnoty) => { $(id).innerHTML = [...new Set(hodnoty.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs')).map(x => `<option value="${esc(x)}">`).join(''); };
    dl('seznamAutoru', vse.map(p => p.autor));
    dl('seznamZdroju', vse.map(p => p.kniha));
    dl('seznamStitku', st.map(s => s.stitek));
  }

  function vykresliDen() {
    const box = $('den');
    if (!nast.den) { box.hidden = true; return; }
    if (!denNahodny || !denPolozka || !vse.some(p => p.id === denPolozka.id)) { denPolozka = V.citatDne(vse); denNahodny = false; }
    box.hidden = !denPolozka;
    if (!denPolozka) return;
    $('denNadpis').textContent = denNahodny ? '🎲 Náhodný citát' : `☀ Citát dne · ${V.datum(Date.now())}`;
    $('denText').textContent = `„${denPolozka.text}“`;
    const kdo = V.podpis(denPolozka);
    $('denKdo').textContent = kdo ? '— ' + kdo : '';
    $('tlDenDnes').hidden = !denNahodny;
    const a = $('denOtevrit');
    a.hidden = !denPolozka.odkaz;
    if (denPolozka.odkaz) { const ad = adresa(denPolozka.odkaz); a.href = ad.href; a.target = ad.target; }
    $('tlDen').setAttribute('aria-pressed', 'true');
  }

  function vykresliVyber() {
    $('tlVyber').setAttribute('aria-pressed', String(!!vyber));
    $('hromadne').hidden = !vyber;
    if (vyber) $('vybranoText').textContent = `Vybráno: ${vyber.size}`;
    $('rozsahExportu').textContent = vyber && vyber.size ? `Export – vybrané (${vyber.size})` : `Export – zobrazené (${zobrazene.length})`;
  }

  function vse_() { vykresliFiltry(); vykresliSeznam(); vykresliDen(); }
  const najdi = id => vse.find(p => p.id === id);

  /* ---------- akce u výpisku ---------- */
  const textCitatu = p => `„${p.text}“${V.podpis(p) ? '\n— ' + V.podpis(p) : ''}${p.kapitola ? ', ' + p.kapitola : ''}`;
  async function kopiruj(text, zprava = '⧉ Zkopírováno') {
    try { await navigator.clipboard.writeText(text); Dialog.info(zprava); }
    catch (e) { Dialog.chyba('Schránka není dostupná.'); }
  }
  $('seznam').addEventListener('click', async e => {
    const el = e.target.closest('[data-akce]');
    const karta = e.target.closest('.vyp');
    if (!karta) return;
    const p = najdi(karta.dataset.id);
    if (!p) return;
    // v režimu výběru klik na kartu (mimo odkazy a tlačítka) přepíná výběr
    if (vyber && (!el || el.dataset.akce === 'vybrat') && !e.target.closest('a')) {
      if (vyber.has(p.id)) vyber.delete(p.id); else vyber.add(p.id);
      karta.classList.toggle('vybrany', vyber.has(p.id));
      karta.querySelector('.zaskrtnout').checked = vyber.has(p.id);
      vykresliVyber();
      return;
    }
    if (!el) return;
    switch (el.dataset.akce) {
      case 'hvezda': upravDoplnek(p, { hvezda: !p.hvezda }); vykresliFiltry(); vykresliSeznam(); break;
      case 'kontext': otevriKontext(p); break;
      case 'obrazek': otevriObrazek(p); break;
      case 'komentar': {
        const t = await Dialog.zeptej('Můj komentář k výpisku (uloží se jen tady, ne do čtečky):', p.komentar, { ok: 'Uložit' });
        if (t == null) return;
        upravDoplnek(p, { komentar: t.trim() }); vse_(); break;
      }
      case 'kopirovat': kopiruj(textCitatu(p)); break;
      case 'stitek': filtr.stitek = V.normalizuj(filtr.stitek) === V.normalizuj(el.dataset.stitek) ? '' : el.dataset.stitek; vse_(); break;
      case 'stitky': {
        const t = await Dialog.zeptej('Štítky (oddělené čárkou):', p.stitky.join(', '), { ok: 'Uložit' });
        if (t == null) return;
        upravDoplnek(p, { stitky: V.stitkyZTextu(t) }); vse_(); break;
      }
      case 'karta': otevriKarty([p]); break;
      case 'upravit': otevriEditor(p); break;
      case 'smazat':
        if (!await Dialog.potvrd(`Smazat citát „${p.text.slice(0, 80)}${p.text.length > 80 ? '…' : ''}“?`, { ok: 'Smazat', zrus: 'Ponechat' })) return;
        data.citaty = data.citaty.filter(c => c.id !== p.vlastniId);
        uloz(); prepocitej(); vse_(); Dialog.info('🗑 Citát smazán');
        break;
    }
  });

  /* ---------- editor vlastního citátu ---------- */
  let upravovany = null, editorPuvodne = '';
  const editorHodnoty = () => ['eText', 'eAutor', 'eZdroj', 'eStitky', 'ePoznamka'].map(id => $(id).value).join('\u0001') + $('eHvezda').checked;
  function otevriEditor(p = null) {
    upravovany = p;
    const c = p ? data.citaty.find(x => x.id === p.vlastniId) : null;
    $('editorNadpis').textContent = c ? '✎ Upravit citát' : '✚ Nový citát';
    $('eText').value = c ? c.text : '';
    $('eAutor').value = c ? c.autor || '' : '';
    $('eZdroj').value = c ? c.zdroj || '' : '';
    $('eStitky').value = c ? (c.stitky || []).join(', ') : (filtr.stitek || '');
    $('ePoznamka').value = c ? c.poznamka || '' : '';
    $('eHvezda').checked = !!(c && c.hvezda);
    $('eSmazat').hidden = !c;
    editorPuvodne = editorHodnoty();
    otevriModal('editorBg');
    $('eText').focus();
  }
  function ulozEditor() {
    const text = $('eText').value.trim();
    if (!text) { Dialog.chyba('Citát nemá text.'); $('eText').focus(); return; }
    const hodnoty = { text, autor: $('eAutor').value.trim(), zdroj: $('eZdroj').value.trim(), stitky: V.stitkyZTextu($('eStitky').value), poznamka: $('ePoznamka').value.trim(), hvezda: $('eHvezda').checked };
    const c = upravovany && data.citaty.find(x => x.id === upravovany.vlastniId);
    editorPuvodne = editorHodnoty();
    if (c) Object.assign(c, hodnoty);
    else data.citaty.push({ id: noveId(), cas: Date.now(), ...hodnoty });
    uloz(); prepocitej(); zavriModal('editorBg'); vse_();
    Dialog.info(c ? '✔ Citát upraven' : '✔ Citát přidán');
  }
  $('eUlozit').onclick = ulozEditor;
  $('eSmazat').onclick = async () => {
    if (!upravovany || !await Dialog.potvrd('Smazat tento citát?', { ok: 'Smazat', zrus: 'Ponechat' })) return;
    data.citaty = data.citaty.filter(c => c.id !== upravovany.vlastniId);
    uloz(); prepocitej(); zavriModal('editorBg'); vse_();
  };
  $('editorBg').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ulozEditor(); } });

  /* ---------- export a import ---------- */
  const proExport = () => vyber && vyber.size ? vse.filter(p => vyber.has(p.id)) : zobrazene;
  function stahni(nazev, obsah, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ }));
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // iPad/iPhone: systémové sdílení souboru (Soubory, Mail, AirDrop…); jinde nebo po chybě stažení
  const lzeSdiletSoubor = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] })); } catch (e) { return false; } };
  async function sdilej(nazev, obsah, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ });
    const f = new File([blob], nazev, { type: blob.type || typ });
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: nazev }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    stahni(nazev, blob);
  }
  const jmeno = pr => `vypisky_${V.dnes()}.${pr}`;
  function exportuj(druh) {
    const p = proExport();
    if (!p.length && druh !== 'json') { Dialog.info('Není co exportovat.'); return; }
    if (druh === 'md') stahni(jmeno('md'), V.exportMd(p), 'text/markdown;charset=utf-8');
    if (druh === 'csv') stahni(jmeno('csv'), V.exportCsv(p), 'text/csv;charset=utf-8');
    if (druh === 'json') stahni(jmeno('json'), V.exportJson(p, data), 'application/json');
    if (druh === 'sdilet-md') { sdilej(jmeno('md'), V.exportMd(p), 'text/markdown'); return; }
    Dialog.info(`⬇ Exportováno ${p.length} výpisků`);
  }
  function importuj(text, nazev = '') {
    let nove, doplnky = {};
    const t = text.trim();
    try {
      if (/\.json$/i.test(nazev) || /^[[{]/.test(t)) ({ citaty: nove, doplnky } = V.importJson(t));
      else nove = V.importCsv(t);
    } catch (e) { Dialog.chyba(`${nazev || 'Text'}: nejde přečíst (${e.message}).`); return null; }
    const r = V.slucCitaty(data.citaty, nove, noveId);
    data.citaty = r.citaty;
    let nDopl = 0;
    for (const [id, d] of Object.entries(doplnky || {})) {
      if (!d || typeof d !== 'object') continue;
      const stare = data.doplnky[id] || { stitky: [], hvezda: false };
      data.doplnky[id] = { stitky: [...new Set([...(stare.stitky || []), ...(Array.isArray(d.stitky) ? d.stitky : [])])], hvezda: !!(stare.hvezda || d.hvezda),
        komentar: String(stare.komentar || d.komentar || '') };
      nDopl++;
    }
    return { ...r, nDopl };
  }
  function poImportu(vysledky) {
    const ok = vysledky.filter(Boolean);
    if (!ok.length) return;
    const s = ok.reduce((a, r) => ({ pridano: a.pridano + r.pridano, preskoceno: a.preskoceno + r.preskoceno, nDopl: a.nDopl + r.nDopl }), { pridano: 0, preskoceno: 0, nDopl: 0 });
    uloz(); nactiVse().then(vse_);
    Dialog.info(`📂 Přidáno ${s.pridano} citátů` + (s.preskoceno ? `, ${s.preskoceno} duplicit přeskočeno` : '') + (s.nDopl ? `, štítky a hvězdy u ${s.nDopl} výpisků` : ''));
  }
  $('souborImport').onchange = async e => {
    const soubory = [...e.target.files];
    e.target.value = '';
    poImportu(await Promise.all(soubory.map(async f => importuj(await f.text(), f.name))));
  };
  $('vlozitOk').onclick = () => {
    const r = importuj($('vlozitText').value);
    if (!r) return;
    zavriModal('vlozitBg'); $('vlozitText').value = '';
    poImportu([r]);
  };

  /* ---------- kartičky k tisku ---------- */
  const PISMA = {
    serif_i: { nazev: 'Liberation Serif kurzíva', soubor: 'fonty/LiberationSerif-Italic.ttf' },
    serif: { nazev: 'Liberation Serif (patkové)', soubor: 'fonty/LiberationSerif-Regular.ttf' },
    sans: { nazev: 'Liberation Sans (bezpatkové)', soubor: 'stitky_panely/fonty/LiberationSans-Regular.ttf' },
    marcellus: { nazev: 'Marcellus (antikva)', soubor: 'fonty/Marcellus-Regular.ttf' },
    courgette: { nazev: 'Courgette (psací)', soubor: 'fonty/Courgette-Regular.ttf' },
    patrick: { nazev: 'Patrick Hand (ručně psané)', soubor: 'fonty/PatrickHand-Regular.ttf' },
    special: { nazev: 'Special Elite (psací stroj)', soubor: 'fonty/SpecialElite-Regular.ttf' },
  };
  $('kVelikost').innerHTML = Object.entries(V.KARTY).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  $('kPismo').innerHTML = Object.entries(PISMA).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');

  // jsPDF se načte až při prvním otevření kartiček
  let jspdfSlib = null;
  const nactiJsPdf = () => jspdfSlib || (jspdfSlib = new Promise((ok, ko) => {
    if (window.jspdf) { ok(window.jspdf.jsPDF); return; }
    const s = document.createElement('script');
    s.src = 'lib/jspdf.umd.min.js';
    s.onload = () => ok(window.jspdf.jsPDF);
    s.onerror = () => { jspdfSlib = null; ko(new Error('jsPDF se nenačetl')); };
    document.head.appendChild(s);
  }));
  // písmo: base64 pro jsPDF (čeština – vestavěná písma jsPDF ji neumějí) + FontFace pro náhled
  const pisma = {};
  function nactiPismo(klic) {
    if (pisma[klic]) return pisma[klic];
    return (pisma[klic] = (async () => {
      const r = await fetch(PISMA[klic].soubor);
      if (!r.ok) throw new Error('Písmo se nenačetlo');
      const buf = await r.arrayBuffer(), b = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      const rodina = 'vyp_' + klic;
      const ff = new FontFace(rodina, buf);
      await ff.load();
      document.fonts.add(ff);
      return { base64: btoa(bin), rodina, soubor: PISMA[klic].soubor.split('/').pop() };
    })().catch(e => { delete pisma[klic]; throw e; }));
  }

  let kartyCitaty = [], kartyArch = 0, kartyStav = null;
  const kn = () => nast.karty;
  function rozmerKarty() {
    const k = V.KARTY[kn().velikost] || V.KARTY.vizitka;
    return kn().orientace === 'vyska' ? { ...k, w: k.h, h: k.w } : { ...k };
  }
  function nastavKartyDoFormulare() {
    const k = kn();
    $('kVelikost').value = k.velikost; $('kOrientace').value = k.orientace; $('kArch').value = k.arch; $('kPismo').value = k.pismo;
    $('kZarovnani').value = k.zarovnani; $('kRamecek').value = k.ramecek; $('kOkraj').value = k.okraj; $('kMezera').value = k.mezera;
    $('kOrezy').checked = k.orezy; $('kUvozovky').checked = k.uvozovky; $('kPodpis').checked = k.podpis;
    $('kMaxPt').value = k.maxPt || rozmerKarty().maxPt;
    $('kMaxPtHodnota').value = $('kMaxPt').value + ' pt';
  }
  async function otevriKarty(seznam) {
    const zVyberu = !seznam && vyber && vyber.size;
    kartyCitaty = (seznam || (zVyberu ? vse.filter(p => vyber.has(p.id)) : zobrazene)).filter(p => p.druh !== 'zalozka' && p.text);
    if (!kartyCitaty.length) { Dialog.info('Žádné citáty k tisku – záložky se na kartičky netisknou.'); return; }
    $('kartyCo').textContent = seznam ? `Kartička z jednoho citátu.` : zVyberu ? `Tisknu vybrané citáty: ${kartyCitaty.length}.` : `Tisknu všechny zobrazené citáty: ${kartyCitaty.length} (pro jen některé použijte ☑ Vybrat).`;
    kartyArch = 0;
    nastavKartyDoFormulare();
    otevriModal('kartyBg');
    await prekresliKarty();
  }
  // měření přes jsPDF (stejné písmo jako v PDF) → zalomení v náhledu = zalomení v PDF
  async function pripravMereni() {
    const [JsPDF, p] = await Promise.all([nactiJsPdf(), nactiPismo(kn().pismo)]);
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    V.pridejPismo(doc, p);
    const cache = new Map();
    const mer = (s, pt) => {
      let w = cache.get(s);
      if (w == null) { w = doc.getStringUnitWidth(s); cache.set(s, w); }
      return w * pt * V.PT;
    };
    return { JsPDF, pismo: p, mer };
  }
  function rozvrhKaret() {
    const k = rozmerKarty();
    if (kn().arch === 'karta') return { archW: k.w, archH: k.h, naArch: 1, sloupce: 1, radky: 1, pozice: [{ x: 0, y: 0 }] };
    return V.rozvrh(k, V.A4, { okraj: +kn().okraj || 0, mezera: +kn().mezera || 0 });
  }
  const volbyKarty = k => ({ okraj: Math.max(4, Math.round(Math.min(k.w, k.h) * 0.1)), uvozovky: kn().uvozovky, podpis: kn().podpis, zarovnani: kn().zarovnani, maxPt: +kn().maxPt || k.maxPt });

  let poradiKaret = 0;   // rychlé změny (posuvník): platí jen poslední výpočet
  async function prekresliKarty() {
    const info = $('kartyInfo'), moje = ++poradiKaret;
    let m;
    try { m = await pripravMereni(); } catch (e) { if (moje === poradiKaret) info.innerHTML = `<span class="varovani">${esc(e.message)}</span>`; return; }
    if (moje !== poradiKaret) return;
    const k = rozmerKarty(), r = rozvrhKaret();
    if (!r.naArch) { info.innerHTML = '<span class="varovani">Karta se s tímto okrajem na arch A4 nevejde – zmenšete okraj.</span>'; kartyStav = null; kresliNahled(null); return; }
    const archy = V.naArchy(kartyCitaty, r.naArch);
    kartyArch = Math.min(kartyArch, archy.length - 1);
    const rozlozeni = new Map(kartyCitaty.map(p => [p.id, V.rozlozKartu(p, k, m.mer, volbyKarty(k))]));
    const orez = kartyCitaty.filter(p => rozlozeni.get(p.id).text.oriznuto).length;
    kartyStav = { m, k, r, archy, rozlozeni };
    info.innerHTML = `Karet na list: ${r.naArch} · listů: ${archy.length}`
      + (r.archW > r.archH && kn().arch === 'a4' ? ' · A4 na šířku' : '')
      + (orez ? `<br><span class="varovani">⚠ Zkrácené dlouhé citáty: ${orez}. Zkuste větší kartu.</span>` : '');
    listuj(0);
  }
  function listuj(o) {
    if (!kartyStav) return;
    const n = kartyStav.archy.length;
    kartyArch = Math.max(0, Math.min(n - 1, kartyArch + o));
    $('kStrana').textContent = `List ${kartyArch + 1} / ${n}`;
    $('kPred').disabled = kartyArch <= 0;
    $('kDalsi').disabled = kartyArch >= n - 1;
    kresliNahled(kartyStav);
  }
  /* Kreslení do plátna v mm; písmo a čáry se přepočítají na pixely zvlášť – WebKit (iPad) kreslí text o velikosti
     pár „pixelů“ ve zvětšené soustavě nespolehlivě. k = pixelů na mm (včetně devicePixelRatio). */
  function platnoG(ctx, k, rodina) {
    return {
      obdelnik(x, y, w, h, tl, barva, carkovane) { ctx.save(); ctx.lineWidth = Math.max(1, tl * k); ctx.strokeStyle = barva; ctx.setLineDash(carkovane ? [1.5 * k, 1.5 * k] : []); ctx.strokeRect(x * k, y * k, w * k, h * k); ctx.restore(); },
      cara(x1, y1, x2, y2, tl, barva) { ctx.save(); ctx.lineWidth = Math.max(1, tl * k); ctx.strokeStyle = barva; ctx.beginPath(); ctx.moveTo(x1 * k, y1 * k); ctx.lineTo(x2 * k, y2 * k); ctx.stroke(); ctx.restore(); },
      text(s, x, y, pt, zarovnani, barva) { ctx.font = `${(pt * V.PT * k).toFixed(2)}px "${rodina}"`; ctx.fillStyle = barva; ctx.textAlign = zarovnani; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x * k, y * k); },
    };
  }

  function kresliNahled(st) {
    const c = $('kNahled'), ctx = c.getContext('2d');
    if (!st) { ctx.clearRect(0, 0, c.width, c.height); return; }
    const { r, k, archy, rozlozeni, m } = st;
    const max = Math.min(640, c.parentElement.clientWidth || 600), dpr = window.devicePixelRatio || 1;
    const s = Math.min(max / r.archW, 560 / r.archH);   // px na mm
    c.style.width = Math.round(r.archW * s) + 'px'; c.style.height = Math.round(r.archH * s) + 'px';
    c.width = Math.round(r.archW * s * dpr); c.height = Math.round(r.archH * s * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);   // papír je vždy bílý
    const g = platnoG(ctx, s * dpr, m.pismo.rodina);
    (archy[kartyArch] || []).forEach((p, i) => V.kresliKartu(g, r.pozice[i].x, r.pozice[i].y, k, rozlozeni.get(p.id), kn()));
  }

  async function stahniPdf(sdilet = false) {
    if (!kartyStav) return;
    const tl = $('kPdf');
    tl.disabled = true;
    try {
      const { m, k, r, archy, rozlozeni } = kartyStav;
      const doc = V.pdfKaret(m.JsPDF, { r, k, archy, rozlozeni, n: kn(), pismo: m.pismo });
      const nazev = `citaty_karticky_${kn().velikost}_${V.dnes()}.pdf`;
      if (sdilet) await sdilej(nazev, doc.output('blob'), 'application/pdf'); else stahni(nazev, doc.output('blob'));
      Dialog.info(`⬇ PDF: kartiček ${kartyCitaty.length}, listů ${archy.length}`);
    } catch (e) { Dialog.chyba(`PDF se nepodařilo vytvořit: ${e.message}`); }
    finally { tl.disabled = false; }
  }
  const zmenaKaret = (klic, hodnota) => { kn()[klic] = hodnota; uloz(); prekresliKarty(); };
  for (const [id, klic] of [['kVelikost', 'velikost'], ['kOrientace', 'orientace'], ['kArch', 'arch'], ['kPismo', 'pismo'], ['kZarovnani', 'zarovnani'], ['kRamecek', 'ramecek']])
    $(id).onchange = e => { if (klic === 'velikost') kn().maxPt = 0; zmenaKaret(klic, e.target.value); if (klic === 'velikost') { $('kMaxPt').value = rozmerKarty().maxPt; $('kMaxPtHodnota').value = $('kMaxPt').value + ' pt'; } };
  for (const [id, klic] of [['kOkraj', 'okraj'], ['kMezera', 'mezera']]) $(id).oninput = e => zmenaKaret(klic, Math.max(0, Math.min(30, +e.target.value || 0)));
  $('kMaxPt').oninput = e => { $('kMaxPtHodnota').value = e.target.value + ' pt'; zmenaKaret('maxPt', +e.target.value); };
  for (const [id, klic] of [['kOrezy', 'orezy'], ['kUvozovky', 'uvozovky'], ['kPodpis', 'podpis']]) $(id).onchange = e => zmenaKaret(klic, e.target.checked);
  $('kPred').onclick = () => listuj(-1);
  $('kDalsi').onclick = () => listuj(1);
  $('kPdf').onclick = () => stahniPdf(false);
  $('kSdilet').onclick = () => stahniPdf(true);

  /* ---------- kontext: celý odstavec z knihy ---------- */
  let kontextPolozka = null, kontextOdstavec = '';
  async function textKapitoly(p) {
    if (p.zdroj === 'ctecka') {
      const o = await ctiCtecku('obsah', p.zdrojId);
      return o && o.md ? o.md[p.soubor] : null;
    }
    const d = (await nactiDila()).find(x => x.dilo.id === p.zdrojId);
    if (!d) return null;
    const kniha = d.knihy.find(k => k.id === p.knihaId), c = kniha && (kniha.kapitoly || []).find(x => x.soubor === p.soubor);
    if (!c) return null;
    try { const r = await fetch(d.dilo.data + p.knihaId + '/' + p.soubor + (c.h ? '?h=' + c.h : '')); return r.ok ? await r.text() : null; } catch (e) { return null; }
  }
  async function otevriKontext(p) {
    kontextPolozka = p;
    $('kontextNadpis').textContent = `📄 ${V.nazevKnihy(p)}${p.kapitola ? ' · ' + p.kapitola : ''}`;
    $('kontextText').innerHTML = '<p class="info-karet">Načítám kapitolu…</p>';
    $('kontextPosun').hidden = true;
    kontextOdstavec = '';
    const a = $('kontextOtevrit');
    a.hidden = !p.odkaz;
    if (p.odkaz) { const ad = adresa(p.odkaz); a.href = ad.href; a.target = ad.target; }
    otevriModal('kontextBg');
    const md = await textKapitoly(p);
    if (kontextPolozka !== p) return;
    const k = md && window.KRONIKY_JADRO ? V.kontext(KRONIKY_JADRO.rozeber(md), p) : null;
    if (!k) {
      $('kontextText').innerHTML = `<p class="info-karet">${md ? 'Text výpisku už v kapitole není – kniha se od té doby změnila.' : 'Text kapitoly se nepodařilo načíst (kniha není v této knihovně nebo jste offline).'}</p>`;
      return;
    }
    const o = k.odstavec;
    $('kontextText').innerHTML = (k.pred ? `<p class="okoli">${esc(k.pred)}</p>` : '')
      + `<p>${esc(o.pred)}<mark style="--pruh:${V.BARVY_HEX[p.barva] || 'var(--accent)'}">${esc(o.shoda)}</mark>${esc(o.po)}</p>`
      + (k.po ? `<p class="okoli">${esc(k.po)}</p>` : '');
    $('kontextPosun').hidden = !k.posunuto;
    kontextOdstavec = o.pred + o.shoda + o.po;
  }
  $('kontextKopirovat').onclick = () => kontextOdstavec && kopiruj(kontextOdstavec);

  /* ---------- citát jako obrázek (PNG) ---------- */
  let obrazekPolozka = null, poradiObrazku = 0;
  const no = () => nast.obrazek;
  $('oFormat').innerHTML = Object.entries(V.OBRAZKY).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  $('oMotiv').innerHTML = Object.entries(V.MOTIVY_OBRAZKU).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  $('oPismo').innerHTML = $('kPismo').innerHTML;
  function otevriObrazek(p) {
    obrazekPolozka = p;
    for (const [id, k] of [['oFormat', 'format'], ['oMotiv', 'motiv'], ['oPismo', 'pismo'], ['oRamecek', 'ramecek']]) $(id).value = no()[k];
    $('oSdilet').hidden = !lzeSdiletSoubor();
    otevriModal('obrazekBg');
    kresliObrazek();
  }
  // vykreslí obrázek v plné velikosti (1080 px) do plátna; náhled je totéž plátno zmenšené stylem
  async function kresliObrazek() {
    const moje = ++poradiObrazku, p = obrazekPolozka;
    let JsPDF, pismo;
    try { [JsPDF, pismo] = await Promise.all([nactiJsPdf(), nactiPismo(no().pismo)]); }
    catch (e) { Dialog.chyba(e.message); return; }
    if (moje !== poradiObrazku) return;
    const doc = new JsPDF({ unit: 'mm' });
    V.pridejPismo(doc, pismo);
    const mer = (s, pt) => doc.getStringUnitWidth(s) * pt * V.PT;
    const f = V.OBRAZKY[no().format], vel = V.velikostObrazku(no().format), motiv = V.MOTIVY_OBRAZKU[no().motiv];
    const c = $('oNahled'), ctx = c.getContext('2d');
    c.width = vel.w; c.height = vel.h;
    ctx.fillStyle = motiv.pozadi; ctx.fillRect(0, 0, vel.w, vel.h);
    const roz = V.rozlozKartu(p, f, mer, { okraj: Math.min(f.w, f.h) * 0.12, maxPt: f.maxPt });
    V.kresliKartu(platnoG(ctx, vel.s, pismo.rodina), 0, 0, f, roz, { ramecek: no().ramecek, barvy: motiv });
  }
  for (const [id, k] of [['oFormat', 'format'], ['oMotiv', 'motiv'], ['oPismo', 'pismo'], ['oRamecek', 'ramecek']])
    $(id).onchange = e => { no()[k] = e.target.value; uloz(); kresliObrazek(); };
  const pngObrazku = () => new Promise(ok => $('oNahled').toBlob(ok, 'image/png'));
  const jmenoObrazku = () => `citat_${V.normalizuj(obrazekPolozka.text).replace(/[^a-z0-9]+/g, '_').slice(0, 30).replace(/^_|_$/g, '') || 'obrazek'}.png`;
  $('oStahnout').onclick = async () => stahni(jmenoObrazku(), await pngObrazku());
  $('oSdilet').onclick = async () => sdilej(jmenoObrazku(), await pngObrazku(), 'image/png');

  /* ---------- modální okna a nabídky ---------- */
  const navrat = {};   // kam vrátit fokus po zavření okna
  function otevriModal(id) { zavriNabidky(); navrat[id] = document.activeElement; $(id).classList.add('zobraz'); }
  function zavriModal(id) {
    $(id).classList.remove('zobraz');
    const n = navrat[id];
    if (n && n.isConnected && n.focus) n.focus({ preventScroll: true });
  }
  // rozepsaný citát se bez dotazu nezahodí
  async function zavriOkno(id) {
    if (id === 'editorBg' && editorHodnoty() !== editorPuvodne && $('eText').value.trim()
      && !await Dialog.potvrd('Zahodit rozepsaný citát?', { ok: 'Zahodit', zrus: 'Psát dál' })) return;
    zavriModal(id);
  }
  const otevrenyModal = () => document.querySelector('.modal-bg.zobraz');
  // zavřít klepnutím vedle okna jen když stisk i puštění byly mimo okno (tažení výběru textu ven okno nezavře)
  let stiskMimo = null;
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('pointerdown', e => { stiskMimo = e.target === bg ? bg : null; });
    bg.addEventListener('click', e => {
      if (e.target.closest('[data-zavrit]')) zavriOkno(bg.id);
      else if (e.target === bg && stiskMimo === bg) zavriOkno(bg.id);
      stiskMimo = null;
    });
  });
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    vykresliVyber();
    $('prHvezdy').setAttribute('aria-pressed', nast.hvezdyNahoru);
    $('prCizi').setAttribute('aria-pressed', nast.cizi);
    $('prZalozky').setAttribute('aria-pressed', nast.zalozky);
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.maxHeight = Math.max(160, innerHeight - r.bottom - 14) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));

  const PRIKAZY = {
    novy: () => otevriEditor(),
    nahodny: () => {
      const p = V.nahodny(zobrazene.length ? zobrazene : vse, Math.random, denPolozka && denPolozka.id);
      if (!p) { Dialog.info('Zatím tu není žádný citát.'); return; }
      denPolozka = p; denNahodny = true; nast.den = true; uloz(); vykresliDen();
      $('hlavni').scrollTo({ top: 0, behavior: 'smooth' });
    },
    den: () => { nast.den = !nast.den || denNahodny; denNahodny = false; uloz(); vykresliDen(); $('tlDen').setAttribute('aria-pressed', String(nast.den)); },
    'den-dnes': () => { denNahodny = false; vykresliDen(); },
    'den-kopirovat': () => denPolozka && kopiruj(textCitatu(denPolozka)),
    'den-obrazek': () => denPolozka && otevriObrazek(denPolozka),
    'den-sdilet': async () => { if (!denPolozka) return; try { await navigator.share({ text: textCitatu(denPolozka) }); } catch (e) { /* zrušeno */ } },
    'sdilet-md': () => exportuj('sdilet-md'),
    vyber: () => { vyber = vyber ? null : new Set(); vykresliSeznam(); },
    'vybrat-vse': () => { zobrazene.forEach(p => vyber.add(p.id)); vykresliSeznam(); },
    'zrusit-vyber': () => { vyber = new Set(); vykresliSeznam(); },
    'hromadne-stitek': async () => {
      if (!vyber.size) { Dialog.info('Nejdřív vyberte výpisky.'); return; }
      const t = await Dialog.zeptej(`Přidat štítek k ${vyber.size} výpiskům:`, '', { ok: 'Přidat' });
      const nove = V.stitkyZTextu(t);
      if (!nove.length) return;
      for (const p of vse) if (vyber.has(p.id)) upravDoplnek(p, { stitky: [...new Set([...p.stitky, ...nove])] });
      vse_();
    },
    karty: () => otevriKarty(),
    'exp-md': () => exportuj('md'), 'exp-csv': () => exportuj('csv'), 'exp-json': () => exportuj('json'),
    'kopirovat-md': () => { const p = proExport(); if (p.length) kopiruj(V.exportMd(p), `📋 Zkopírováno ${p.length} výpisků`); },
    import: () => $('souborImport').click(),
    'import-vlozit': () => { otevriModal('vlozitBg'); $('vlozitText').focus(); },
    obnovit: async () => { dilaCache = null; await nactiVse(); vse_(); Dialog.info(`↻ Načteno ${vse.length} výpisků`); },
    'hvezdy-nahoru': () => { nast.hvezdyNahoru = !nast.hvezdyNahoru; uloz(); vykresliSeznam(); },
    cizi: async () => { nast.cizi = !nast.cizi; uloz(); await nactiVse(); vse_(); },
    zalozky: () => { nast.zalozky = !nast.zalozky; if (!nast.zalozky && filtr.druh === 'zalozka') filtr.druh = ''; uloz(); vse_(); },
    'zrusit-filtry': () => { Object.assign(filtr, { hledat: '', druh: '', barva: '', kniha: '', stitek: '', jenPoznamka: false, jenHvezda: false }); $('hledat').value = ''; vse_(); },
    filtry: () => document.body.classList.toggle('filtry-otevrene'),
    dalsi: () => { limit += 200; vykresliSeznam(); },
    napoveda: () => otevriModal('napovedaBg'),
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); PRIKAZY[b.dataset.prikaz](); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    // na mobilu zavřít panel filtrů klepnutím mimo něj
    if (document.body.classList.contains('filtry-otevrene') && !e.target.closest('aside') && !e.target.closest('#tlFiltry')) document.body.classList.remove('filtry-otevrene');
  });
  addEventListener('resize', zavriNabidky);

  /* ---------- filtry v panelu ---------- */
  $('filtry').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.druh != null) filtr.druh = b.dataset.druh;
    else if (b.dataset.barva != null) filtr.barva = filtr.barva === b.dataset.barva ? '' : b.dataset.barva;
    else if (b.dataset.kniha != null) filtr.kniha = b.dataset.kniha;
    else if (b.dataset.stitek != null) filtr.stitek = V.normalizuj(filtr.stitek) === V.normalizuj(b.dataset.stitek) ? '' : b.dataset.stitek;
    else return;
    limit = 200; vykresliFiltry(); vykresliSeznam();
  });
  $('fPoznamka').onchange = e => { filtr.jenPoznamka = e.target.checked; vykresliSeznam(); };
  $('fHvezda').onchange = e => { filtr.jenHvezda = e.target.checked; vykresliSeznam(); };
  let casHledani = 0;
  $('hledat').addEventListener('input', e => { clearTimeout(casHledani); casHledani = setTimeout(() => { filtr.hledat = e.target.value; limit = 200; vykresliSeznam(); }, 120); });
  $('razeni').value = nast.razeni;
  $('razeni').onchange = e => { nast.razeni = e.target.value; uloz(); vykresliSeznam(); };

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', e => {
    const m = otevrenyModal();
    if (e.key === 'Escape') {
      if (document.querySelector('dialog[open]')) return;   // Esc zavře jen dotaz dialog.js, ne okno pod ním
      if (m) { e.preventDefault(); zavriOkno(m.id); return; }
      if (!document.querySelector('.nabidka:not([hidden])') && vyber) { vyber = null; vykresliSeznam(); }
      zavriNabidky(); document.body.classList.remove('filtry-otevrene');
      return;
    }
    if (e.key === 'F1') { e.preventDefault(); PRIKAZY.napoveda(); return; }
    if (m || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = { '/': () => $('hledat').focus(), n: PRIKAZY.novy, r: PRIKAZY.nahodny, d: PRIKAZY.den, v: PRIKAZY.vyber, p: PRIKAZY.karty }[e.key.toLowerCase()];
    if (k) { e.preventDefault(); k(); }
  });

  // změna poznámek v jiném okně (čtečka otevřená vedle) → načíst znovu
  addEventListener('storage', e => {
    if (!e.key || !/^webapp_(ctecka_knih_.+_poznamky|.+_poznamky|vypisky)$/.test(e.key)) return;
    if (e.key === KLIC) { try { const u = JSON.parse(e.newValue) || {}; data.citaty = u.citaty || []; data.doplnky = u.doplnky || {}; } catch (x) { /* nic */ } }
    nactiVse().then(vse_);
  });

  /* ---------- start ---------- */
  if (matchMedia('(max-width:760px)').matches) document.body.classList.remove('filtry-otevrene');
  $('seznam').innerHTML = '<div class="prazdne">Načítám výpisky…</div>';
  $('tlDenSdilet').hidden = !navigator.share;
  $('tlSdiletMd').hidden = !lzeSdiletSoubor();
  $('kSdilet').hidden = !lzeSdiletSoubor();
  nactiVse().then(vse_);
  window.VYPISKY_APP = { stav: () => ({ vse, filtr, nast, data, nacteno }), prikaz: id => PRIKAZY[id](), otevriKarty, kartyStav: () => kartyStav, otevriKontext, otevriObrazek };
})();
