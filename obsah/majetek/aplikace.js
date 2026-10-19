/* Evidence majetku – uživatelské rozhraní. Data: window.MajetekDB (IndexedDB), výpočty: window.MajetekJadro. */
(function () {
  'use strict';
  const J = window.MajetekJadro, DB = window.MajetekDB, ST = window.MajetekStitky;
  const $ = id => document.getElementById(id);
  const LS = 'webapp_majetek_';
  const lsCti = (k, v) => { try { const x = localStorage.getItem(LS + k); return x == null ? v : JSON.parse(x); } catch (e) { return v; } };
  const lsPis = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { /* plné nebo zakázané */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IKONY = { foto: '🖼', uctenka: '🧾', navod: '📘', servis: '🔧', jine: '📄' };

  let S = { polozky: [], lokality: [], mistnosti: [], kategorie: [], prilohy: [], nastaveni: {}, posledniZaloha: 0 };
  let ctx = J.kontext(S);
  let dnes = J.dnesIso();
  const vybrane = new Set();
  let urlSeznam = [];
  let skrytaUpozorneni = false;
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('webapp_majetek') : null;

  const nast = () => Object.assign({ vychoziZaruka: J.VYCHOZI_ZARUKA, upozornitDni: 30, fotoMax: 2048, zalohaDni: 30 }, S.nastaveni || {});
  const info = t => Dialog.info(t), chyba = t => Dialog.chyba(t);

  /* ---------- načtení a první spuštění ---------- */
  async function nacti() {
    S = await DB.nactiVse();
    ctx = J.kontext(S);
    dnes = J.dnesIso();
  }
  async function prvniSpusteni() {
    const lok = { id: J.novyId('L'), nazev: 'Domov', adresa: '' };
    const mist = ['Obývací pokoj', 'Kuchyně', 'Ložnice', 'Dětský pokoj', 'Pracovna', 'Koupelna', 'Předsíň', 'Sklep', 'Garáž'].map(n => ({ id: J.novyId('R'), nazev: n, lokalitaId: lok.id }));
    const kat = ['Elektronika', 'Velké spotřebiče', 'Malé spotřebiče', 'Nábytek', 'Nářadí a dílna', 'Sport a volný čas', 'Šperky a cennosti', 'Oblečení', 'Zahrada', 'Ostatní']
      .map(n => ({ id: J.novyId('K'), nazev: n }));
    await DB.nahradVse({ lokality: [lok], mistnosti: mist, kategorie: kat, polozky: [], prilohy: [], nastaveni: {} });
  }

  async function obnovVse(oznamit) {
    await nacti();
    vykresli();
    if (oznamit && bc) try { bc.postMessage('zmena'); } catch (e) { /* ignorovat */ }
  }

  /* ---------- záložky ---------- */
  let aktivni = 'polozky';
  function prepni(list) {
    aktivni = list;
    for (const b of $('listy').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.list === list));
    for (const s of document.querySelectorAll('.list')) s.hidden = s.id !== 'list-' + list;
    lsPis('list', list);
    vykresliAktivni();
  }
  $('listy').addEventListener('click', e => { const b = e.target.closest('button[data-list]'); if (b) prepni(b.dataset.list); });

  function vykresli() {
    vyplnVolby();
    $('pocetPolozek').textContent = S.polozky.filter(p => !p.smazano).length;
    $('pocetKos').textContent = S.polozky.filter(p => p.smazano).length;
    vykresliAktivni();
  }
  function vykresliAktivni() {
    if (aktivni === 'polozky') vykresliSeznam();
    else if (aktivni === 'prehled') vykresliPrehled();
    else if (aktivni === 'stitky') vykresliStitky();
    else if (aktivni === 'ciselniky') vykresliCiselniky();
    else if (aktivni === 'kos') vykresliKos();
    else if (aktivni === 'zaloha') vykresliZalohu();
  }

  /* ---------- volby selectů ---------- */
  const serazene = a => a.slice().sort((x, y) => x.nazev.localeCompare(y.nazev, 'cs'));
  function moznosti(sel, polozky, prvni, extra) {
    const v = sel.value;
    sel.innerHTML = (prvni != null ? '<option value="">' + esc(prvni) + '</option>' : '') + (extra || '') +
      polozky.map(x => '<option value="' + esc(x.id) + '">' + esc(x.nazev) + '</option>').join('');
    if ([...sel.options].some(o => o.value === v)) sel.value = v;
  }
  function vsechnyStitky() {
    const m = new Map();
    for (const p of S.polozky) if (!p.smazano) for (const s of p.stitky || []) { const k = J.bezDiakritiky(s); const r = m.get(k) || { nazev: s, pocet: 0 }; r.pocet++; m.set(k, r); }
    return [...m.values()].sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
  }
  function mistnostiLokality(lid) { return serazene(S.mistnosti.filter(m => !lid || m.lokalitaId === lid)); }
  function vyplnVolby() {
    moznosti($('fKategorie'), serazene(S.kategorie), 'všechny', '<option value="-">— bez kategorie —</option>');
    moznosti($('fLokalita'), serazene(S.lokality), 'všechny');
    moznosti($('fMistnost'), mistnostiLokality($('fLokalita').value), 'všechny');
    moznosti($('fStitek'), vsechnyStitky().map(s => ({ id: s.nazev, nazev: s.nazev + ' (' + s.pocet + ')' })), 'všechny');
    const dl = (id, pole) => { $(id).innerHTML = [...new Set(pole.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs')).map(x => '<option value="' + esc(x) + '">').join(''); };
    dl('dlVyrobci', S.polozky.map(p => p.vyrobce)); dl('dlProdejci', S.polozky.map(p => p.prodejce)); dl('dlStitky', vsechnyStitky().map(s => s.nazev));
  }

  /* ---------- filtr a seznam ---------- */
  const FILTRY = ['fDotaz', 'fKategorie', 'fLokalita', 'fMistnost', 'fStitek', 'fZaruka', 'fRazeni', 'fPriloha', 'fBezCeny'];
  function filtr() {
    return { dotaz: $('fDotaz').value, kategorieId: $('fKategorie').value, lokalitaId: $('fLokalita').value, mistnostId: $('fMistnost').value,
      stitek: $('fStitek').value, zaruka: $('fZaruka').value, sPrilohou: $('fPriloha').checked, bezCeny: $('fBezCeny').checked };
  }
  function polozkySPrilohou() { return new Set(S.prilohy.map(a => a.polozkaId)); }
  function zobrazene() {
    const f = filtr();
    return J.serad(J.filtruj(S.polozky, f, ctx, dnes, nast().upozornitDni, polozkySPrilohou()), $('fRazeni').value, ctx);
  }
  for (const id of FILTRY) $(id).addEventListener(id === 'fDotaz' ? 'input' : 'change', () => {
    if (id === 'fLokalita') moznosti($('fMistnost'), mistnostiLokality($('fLokalita').value), 'všechny');
    ulozFiltry(); vykresliSeznam();
  });
  function ulozFiltry() { const o = {}; for (const id of FILTRY) o[id] = $(id).type === 'checkbox' ? $(id).checked : $(id).value; lsPis('filtry', o); }
  function nactiFiltry() {
    const o = lsCti('filtry', {});
    for (const id of FILTRY) if (o[id] != null) { if ($(id).type === 'checkbox') $(id).checked = !!o[id]; else $(id).value = o[id]; }
  }
  $('btnZrusFiltry').addEventListener('click', () => {
    for (const id of FILTRY) { if ($(id).type === 'checkbox') $(id).checked = false; else if (id !== 'fRazeni') $(id).value = ''; }
    vyplnVolby(); ulozFiltry(); vykresliSeznam();
  });

  function nahledyPolozek() {
    const m = new Map();
    for (const a of S.prilohy) {
      if (a.typ !== 'foto' || !(a.nahled || /^image\//.test(a.mime))) continue;
      const pr = m.get(a.polozkaId);
      if (!pr || a.vytvoreno < pr.vytvoreno) m.set(a.polozkaId, a);
    }
    return m;
  }
  function stavHtml(p) {
    const s = J.stavZaruky(p, dnes, nast().upozornitDni);
    if (s.stav === 'bez') return '<span class="zaruka bez">záruka neuvedena</span>';
    const d = J.formatDatum(s.z.posledniDen);
    if (s.stav === 'prosla') return '<span class="zaruka prosla" title="Poslední den pro uplatnění byl ' + d + '">záruka skončila ' + d + '</span>';
    if (s.stav === 'konci') return '<span class="zaruka konci" title="Poslední den pro uplatnění">' + (s.dni === 0 ? 'záruka končí dnes' : 'záruka končí za ' + s.dni + ' ' + sklon(s.dni, 'den', 'dny', 'dní')) + '</span>';
    return '<span class="zaruka platna" title="Poslední den pro uplatnění">záruka do ' + d + '</span>';
  }
  function sklon(n, a, b, c) { n = Math.abs(n); return n === 1 ? a : (n >= 2 && n <= 4 ? b : c); }
  function radekPolozky(p, nahled, kos) {
    const k = ctx.kat.get(p.kategorieId), misto = J.nazevMista(p, ctx);
    const det = [[p.vyrobce, p.model].filter(Boolean).join(' '), p.seriove ? 'SN ' + p.seriove : '', k ? k.nazev : '', misto].filter(Boolean).map(esc).join(' · ');
    let img = '<div class="nahl" aria-hidden="true">' + '📦' + '</div>';
    if (nahled) { const u = URL.createObjectURL(nahled.nahled || nahled.blob); urlSeznam.push(u); img = '<div class="nahl"><img src="' + u + '" alt="" loading="lazy"></div>'; }
    const pocetPril = S.prilohy.filter(a => a.polozkaId === p.id).length;
    return '<div class="pol' + (vybrane.has(p.id) && !kos ? ' vybrana' : '') + '" data-id="' + esc(p.id) + '">' +
      (kos ? '<span></span>' : '<input type="checkbox" data-vyber aria-label="Vybrat ' + esc(p.nazev) + '"' + (vybrane.has(p.id) ? ' checked' : '') + '>') + img +
      '<div style="min-width:0"><div class="nazev">' + esc(p.nazev) + ' <span class="faint">' + esc(p.id) + '</span></div><div class="det">' + (det || '&nbsp;') + '</div>' +
      '<div>' + (p.stitky || []).map(s => '<span class="stitek">' + esc(s) + '</span>').join('') + '</div></div>' +
      '<div class="vpravo"><span class="cena">' + (p.cena == null ? '<span class="faint">cena neuvedena</span>' : J.formatKc(p.cena)) + '</span>' +
      (kos ? '<span class="faint">smazáno ' + new Date(p.smazano).toLocaleDateString('cs-CZ') + '</span><span class="rada"><button class="maly" data-obnovit>Obnovit</button><button class="maly nebezpecne" data-trvale>Smazat trvale</button></span>'
        : stavHtml(p) + (pocetPril ? '<span class="faint">📎 ' + pocetPril + '</span>' : '')) + '</div></div>';
  }
  function uvolniUrl() { for (const u of urlSeznam) URL.revokeObjectURL(u); urlSeznam = []; }
  const LIMIT = 400;
  let limit = LIMIT;
  function vykresliSeznam() {
    uvolniUrl();
    const pol = zobrazene();
    const nh = nahledyPolozek();
    const celkem = pol.reduce((s, p) => s + (p.cena || 0), 0);
    const aktivnich = S.polozky.filter(p => !p.smazano).length;
    $('souhrnFiltru').innerHTML = '<b>' + pol.length + '</b> z ' + aktivnich + ' ' + sklon(aktivnich, 'položky', 'položek', 'položek') +
      ' · pořizovací hodnota <b>' + J.formatKc(celkem) + '</b>' + (vybrane.size ? ' · vybráno <b>' + vybrane.size + '</b>' : '');
    $('btnKosVybr').disabled = !vybrane.size;
    $('vybratVse').checked = pol.length > 0 && pol.every(p => vybrane.has(p.id));
    if (!aktivnich) {
      $('seznam').innerHTML = '<div class="karta prazdne">Zatím tu nic není.<div class="rada mezera" style="justify-content:center">' +
        '<button class="hlavni" data-akce="nova">+ Přidat první položku</button><button data-akce="ukazka">Vložit ukázková data</button></div></div>';
      return;
    }
    if (!pol.length) { $('seznam').innerHTML = '<div class="karta prazdne">Filtru neodpovídá žádná položka.</div>'; return; }
    $('seznam').innerHTML = pol.slice(0, limit).map(p => radekPolozky(p, nh.get(p.id))).join('') +
      (pol.length > limit ? '<div class="prazdne"><button data-akce="vic">Zobrazit dalších ' + Math.min(LIMIT, pol.length - limit) + ' (celkem ' + pol.length + ')</button></div>' : '');
  }
  $('seznam').addEventListener('click', e => {
    const a = e.target.closest('[data-akce]');
    if (a) { if (a.dataset.akce === 'nova') otevriEditor(null); else if (a.dataset.akce === 'ukazka') vlozUkazku(); else if (a.dataset.akce === 'vic') { limit += LIMIT; vykresliSeznam(); } return; }
    const r = e.target.closest('.pol'); if (!r) return;
    if (e.target.matches('[data-vyber]')) {
      if (e.target.checked) vybrane.add(r.dataset.id); else vybrane.delete(r.dataset.id);
      r.classList.toggle('vybrana', e.target.checked); vykresliSouhrnVyberu(); return;
    }
    otevriEditor(r.dataset.id);
  });
  function vykresliSouhrnVyberu() {
    const pol = zobrazene();
    $('btnKosVybr').disabled = !vybrane.size;
    $('vybratVse').checked = pol.length > 0 && pol.every(p => vybrane.has(p.id));
    const t = $('souhrnFiltru'); const m = t.innerHTML.replace(/ · vybráno <b>\d+<\/b>$/, '');
    t.innerHTML = m + (vybrane.size ? ' · vybráno <b>' + vybrane.size + '</b>' : '');
  }
  $('vybratVse').addEventListener('change', e => { for (const p of zobrazene()) { if (e.target.checked) vybrane.add(p.id); else vybrane.delete(p.id); } vykresliSeznam(); });
  $('btnKosVybr').addEventListener('click', async () => {
    const ids = [...vybrane].filter(id => S.polozky.some(p => p.id === id && !p.smazano));
    if (!ids.length) return;
    if (!await Dialog.potvrd('Přesunout ' + ids.length + ' ' + sklon(ids.length, 'vybranou položku', 'vybrané položky', 'vybraných položek') + ' do koše? Z koše je lze obnovit.', { ok: 'Do koše' })) return;
    const ted = Date.now();
    await zapis(() => DB.uloz('polozky', S.polozky.filter(p => ids.includes(p.id)).map(p => Object.assign({}, p, { smazano: ted, upraveno: ted }))));
    vybrane.clear(); info('Přesunuto do koše: ' + ids.length + '.'); await obnovVse(true);
  });

  async function zapis(fn) {
    try { await fn(); return true; } catch (e) { chyba('Uložení selhalo: ' + DB.popisChyby(e)); console.error(e); return false; }
  }
  function stahni(blob, jmeno) {
    const u = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = u; a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  function pocetPriloh() { const m = new Map(); for (const a of S.prilohy) m.set(a.polozkaId, (m.get(a.polozkaId) || 0) + 1); return m; }
  function exportCsv(pol, jmeno) {
    if (!pol.length) { chyba('Žádné položky k exportu.'); return; }
    stahni(new Blob([J.csv(pol, ctx, dnes, nast().upozornitDni, pocetPriloh())], { type: 'text/csv;charset=utf-8' }), jmeno);
  }
  $('btnCsv').addEventListener('click', () => exportCsv(zobrazene(), 'majetek_' + dnes + '.csv'));
  $('btnCsvVse').addEventListener('click', () => exportCsv(J.serad(S.polozky.filter(p => !p.smazano), 'nazev', ctx), 'majetek_vse_' + dnes + '.csv'));
  function exportIcs(pol) {
    const s = pol.filter(p => { const z = J.stavZaruky(p, dnes, 0); return z.stav !== 'bez' && z.stav !== 'prosla'; });
    if (!s.length) { chyba('Žádná z položek nemá běžící záruku.'); return; }
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    stahni(new Blob([J.ics(s, nast().upozornitDni, ts)], { type: 'text/calendar;charset=utf-8' }), 'zaruky_' + dnes + '.ics');
    info('Kalendář obsahuje ' + s.length + ' ' + sklon(s.length, 'událost', 'události', 'událostí') + ' s připomínkou ' + nast().upozornitDni + ' dní předem. Otevřete jej v aplikaci kalendáře.');
  }
  $('btnIcs').addEventListener('click', () => exportIcs(zobrazene()));
  $('btnStitkyVybr').addEventListener('click', () => { $('sZdroj').value = vybrane.size ? 'vybrane' : 'filtr'; prepni('stitky'); });

  /* ---------- upozornění při otevření ---------- */
  async function vykresliUpozorneni() {
    const el = $('upozorneni');
    if (skrytaUpozorneni) { el.innerHTML = ''; return; }
    const n = nast(), casti = [];
    const akt = S.polozky.filter(p => !p.smazano);
    const konci = [], prosle = [];
    for (const p of akt) {
      const s = J.stavZaruky(p, dnes, n.upozornitDni);
      if (s.stav === 'konci') konci.push([p, s]);
      else if (s.stav === 'prosla' && s.dni >= -30) prosle.push([p, s]);
    }
    konci.sort((a, b) => a[1].dni - b[1].dni);
    const li = ([p, s], t) => '<li><button class="odkaz" data-otevri="' + esc(p.id) + '">' + esc(p.nazev) + '</button> – ' + t(s) + '</li>';
    if (konci.length) casti.push('<div class="hlaseni"><b class="t">⏳ Blíží se konec záruky (' + konci.length + ')</b><ul>' +
      konci.slice(0, 12).map(x => li(x, s => (s.dni === 0 ? '<b>dnes</b> je poslední den' : 'poslední den ' + J.formatDatum(s.z.posledniDen) + ' (za ' + s.dni + ' ' + sklon(s.dni, 'den', 'dny', 'dní') + ')'))).join('') +
      (konci.length > 12 ? '<li>… a další ' + (konci.length - 12) + '</li>' : '') + '</ul>' +
      '<span class="faint">Vadu reklamujte u prodejce nejpozději v poslední den. Kontroluje se jen při otevření této stránky.</span></div>');
    if (prosle.length) casti.push('<div class="hlaseni info"><b>Záruka nedávno skončila (' + prosle.length + ')</b><ul>' +
      prosle.slice(0, 6).map(x => li(x, s => 'poslední den byl ' + J.formatDatum(s.z.posledniDen))).join('') + '</ul></div>');
    const zm = akt.reduce((m, p) => Math.max(m, p.upraveno || 0), 0);
    if (akt.length && n.zalohaDni > 0 && zm > (S.posledniZaloha || 0) && Date.now() - (S.posledniZaloha || 0) > n.zalohaDni * 864e5)
      casti.push('<div class="hlaseni info"><b>💾 Záloha</b> – ' + (S.posledniZaloha ? 'poslední záloha ' + new Date(S.posledniZaloha).toLocaleDateString('cs-CZ') + ', od té doby se data změnila.' : 'data zatím nikdy nebyla zálohována.') +
        ' Data jsou jen v tomto prohlížeči. <button class="maly" data-akce-up="zaloha">Stáhnout zálohu</button></div>');
    const u = await DB.odhad();
    if (u.usage != null && u.quota && u.usage / u.quota > 0.8)
      casti.push('<div class="hlaseni chyba"><b>Úložiště je téměř plné</b> – využito ' + J.velikost(u.usage) + ' z ' + J.velikost(u.quota) + '. Nové přílohy nemusí jít uložit.</div>');
    if (casti.length) casti.push('<div class="rada" style="margin:-4px 0 12px"><button class="maly" data-akce-up="skryt">Skrýt upozornění</button></div>');
    el.innerHTML = casti.join('');
  }
  $('upozorneni').addEventListener('click', e => {
    const o = e.target.closest('[data-otevri]'); if (o) { otevriEditor(o.dataset.otevri); return; }
    const a = e.target.closest('[data-akce-up]'); if (!a) return;
    if (a.dataset.akceUp === 'skryt') { skrytaUpozorneni = true; vykresliUpozorneni(); }
    else if (a.dataset.akceUp === 'zaloha') stahniZalohu();
  });

  /* ---------- editor položky ---------- */
  let ed = null;
  const dlgP = $('dlgPolozka');
  function hodnotyFormulare() {
    return { nazev: $('pNazev').value, vyrobce: $('pVyrobce').value, model: $('pModel').value, seriove: $('pSeriove').value,
      kategorieId: $('pKategorie').value, lokalitaId: $('pLokalita').value, mistnostId: $('pMistnost').value, cena: $('pCena').value,
      datumNakupu: $('pNakup').value, datumPrevzeti: $('pPrevzeti').value, prodejce: $('pProdejce').value,
      zarukaMesice: $('pZaruka').value, stitky: $('pStitky').value, poznamka: $('pPoznamka').value, servis: ctiServis() };
  }
  function otisk() { return JSON.stringify(hodnotyFormulare()) + '|' + (ed ? ed.nove.length + ':' + [...ed.smazane].join() + ':' + JSON.stringify(ed.typy) : ''); }
  function otevriEditor(id, sablona) {
    const p = id ? S.polozky.find(x => x.id === id) : null;
    if (id && !p) { chyba('Položka ' + id + ' v této evidenci není.'); return; }
    const z = p || Object.assign({ zarukaMesice: nast().vychoziZaruka, datumNakupu: dnes, stitky: [], servis: [] }, sablona || {});
    ed = { id: p ? p.id : null, puvodni: p, nove: [], smazane: new Set(), typy: {}, urls: [] };
    $('pTitulek').textContent = p ? (p.smazano ? 'Položka v koši' : 'Upravit položku') : 'Nová položka';
    $('pId').textContent = p ? p.id : '';
    moznosti($('pKategorie'), serazene(S.kategorie), '— bez kategorie —');
    moznosti($('pLokalita'), serazene(S.lokality), '— neuvedeno —');
    $('pKategorie').value = z.kategorieId || ''; $('pLokalita').value = z.lokalitaId || (S.mistnosti.find(m => m.id === z.mistnostId) || {}).lokalitaId || '';
    moznosti($('pMistnost'), mistnostiLokality($('pLokalita').value), '— neuvedeno —'); $('pMistnost').value = z.mistnostId || '';
    $('pNazev').value = z.nazev || ''; $('pVyrobce').value = z.vyrobce || ''; $('pModel').value = z.model || ''; $('pSeriove').value = z.seriove || '';
    $('pCena').value = z.cena == null ? '' : String(z.cena).replace('.', ',');
    $('pNakup').value = z.datumNakupu || ''; $('pPrevzeti').value = z.datumPrevzeti || ''; $('pProdejce').value = z.prodejce || '';
    $('pZaruka').value = z.zarukaMesice == null ? '' : z.zarukaMesice;
    $('pStitky').value = (z.stitky || []).join(', '); $('pPoznamka').value = z.poznamka || '';
    $('pServis').innerHTML = ''; for (const s of z.servis || []) pridejServis(s);
    for (const b of ['pStitek', 'pIcs', 'pDuplikat', 'pSmazat']) $(b).hidden = !p;
    $('pSmazat').textContent = p && p.smazano ? 'Obnovit z koše' : 'Do koše';
    vykresliPrilohyEditoru(); aktualizujZaruku();
    ed.otisk = otisk();
    if (!dlgP.open) dlgP.showModal();
    if (!p) $('pNazev').focus();
    if (location.hash !== '#p=' + (p ? p.id : '')) history.replaceState(null, '', p ? '#p=' + p.id : location.pathname + location.search);
  }
  async function zavritEditor(vynutit) {
    if (!ed) { dlgP.close(); return; }
    if (!vynutit && otisk() !== ed.otisk && !await Dialog.potvrd('Zahodit neuložené změny?', { ok: 'Zahodit', zrus: 'Pokračovat v úpravách' })) return;
    for (const u of ed.urls) URL.revokeObjectURL(u);
    ed = null; dlgP.close();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  dlgP.addEventListener('cancel', e => { e.preventDefault(); zavritEditor(); });
  dlgP.querySelectorAll('[data-zavrit]').forEach(b => b.addEventListener('click', () => zavritEditor()));
  $('pLokalita').addEventListener('change', () => moznosti($('pMistnost'), mistnostiLokality($('pLokalita').value), '— neuvedeno —'));
  $('pMistnost').addEventListener('change', () => { const m = S.mistnosti.find(x => x.id === $('pMistnost').value); if (m && m.lokalitaId) $('pLokalita').value = m.lokalitaId; });
  for (const id of ['pNakup', 'pPrevzeti', 'pZaruka']) $(id).addEventListener('input', aktualizujZaruku);
  $('pCena').addEventListener('change', () => { const c = J.cislo($('pCena').value); $('pCena').classList.toggle('chyba', $('pCena').value.trim() !== '' && c == null); });
  const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  function aktualizujZaruku() {
    const z = J.zaruka({ datumNakupu: $('pNakup').value, datumPrevzeti: $('pPrevzeti').value, zarukaMesice: $('pZaruka').value });
    const el = $('pZarukaInfo');
    if (!z) { el.innerHTML = '<span class="faint">Vyplňte datum nákupu a záruční lhůtu – výchozí je ' + nast().vychoziZaruka + ' měsíců (lze změnit v Nastavení).</span>'; return; }
    const s = J.stavZaruky({ datumNakupu: z.pocatek, zarukaMesice: $('pZaruka').value }, dnes, nast().upozornitDni);
    let t = 'Záruka od ' + J.formatDatum(z.pocatek) + ' do <b>' + J.formatDatum(z.konec) + '</b>';
    if (z.posledniDen !== z.konec) t += ' (' + DNY[J.denVTydnu(z.konec)] + ([0, 6].includes(J.denVTydnu(z.konec)) ? '' : ', svátek') + ' – není pracovní den), poslední den pro uplatnění je proto <b>' + DNY[J.denVTydnu(z.posledniDen)] + ' ' + J.formatDatum(z.posledniDen) + '</b> (§ 607 OZ)';
    t += '. ' + (s.stav === 'prosla' ? 'Záruka už skončila.' : s.dni === 0 ? 'Dnes je poslední den.' : 'Zbývá ' + s.dni + ' ' + sklon(s.dni, 'den', 'dny', 'dní') + '.');
    el.innerHTML = t;
  }

  function pridejServis(s) {
    s = s || { id: J.novyId('S'), datum: dnes, popis: '', dodavatel: '', cena: null };
    const tr = document.createElement('tr'); tr.dataset.id = s.id;
    tr.innerHTML = '<td><input type="date" data-k="datum" aria-label="Datum servisu"></td><td class="popis"><input type="text" data-k="popis" placeholder="výměna ložisek, kalibrace…" aria-label="Popis zásahu"></td>' +
      '<td><input type="text" data-k="dodavatel" placeholder="servis" aria-label="Servis"></td><td><input type="text" data-k="cena" inputmode="decimal" aria-label="Cena servisu"></td>' +
      '<td><button type="button" class="maly nebezpecne" title="Odebrat záznam" aria-label="Odebrat záznam">✕</button></td>';
    tr.querySelector('[data-k=datum]').value = s.datum || ''; tr.querySelector('[data-k=popis]').value = s.popis || '';
    tr.querySelector('[data-k=dodavatel]').value = s.dodavatel || ''; tr.querySelector('[data-k=cena]').value = s.cena == null ? '' : String(s.cena).replace('.', ',');
    tr.querySelector('button').addEventListener('click', async () => {
      const prazdny = !tr.querySelector('[data-k=popis]').value.trim();
      if (prazdny || await Dialog.potvrd('Odebrat tento servisní záznam? (Projeví se po uložení položky.)', { ok: 'Odebrat' })) tr.remove();
    });
    $('pServis').appendChild(tr);
  }
  $('pServisPridat').addEventListener('click', () => { pridejServis(); const r = $('pServis').lastElementChild; if (r) r.querySelector('[data-k=popis]').focus(); });
  function ctiServis() {
    return [...$('pServis').querySelectorAll('tr')].map(tr => ({ id: tr.dataset.id, datum: tr.querySelector('[data-k=datum]').value,
      popis: tr.querySelector('[data-k=popis]').value, dodavatel: tr.querySelector('[data-k=dodavatel]').value, cena: tr.querySelector('[data-k=cena]').value }))
      .filter(s => s.popis.trim() || s.dodavatel.trim() || s.cena.trim());
  }

  /* přílohy v editoru: stávající (z S.prilohy) + čekající (ed.nove), mazání až po uložení */
  function vykresliPrilohyEditoru() {
    for (const u of ed.urls) URL.revokeObjectURL(u); ed.urls = [];
    const stavajici = ed.id ? S.prilohy.filter(a => a.polozkaId === ed.id).sort((a, b) => a.vytvoreno - b.vytvoreno) : [];
    const vse = stavajici.map(a => ({ a, cek: false })).concat(ed.nove.map(a => ({ a, cek: true })));
    const vel = vse.filter(x => !ed.smazane.has(x.a.id)).reduce((s, x) => s + (x.a.velikost || 0), 0);
    $('pPrilohyInfo').textContent = vse.length ? vse.length + ' ' + sklon(vse.length, 'soubor', 'soubory', 'souborů') + ', ' + J.velikost(vel) : 'Fotky se zmenšují podle Nastavení; ostatní soubory se ukládají beze změny.';
    $('pPrilohy').innerHTML = vse.map(({ a, cek }) => {
      const n = a.nahled || (/^image\//.test(a.mime) && a.velikost < 3e6 ? a.blob : null);
      let nh = IKONY[a.typ] || '📄';
      if (n) { const u = URL.createObjectURL(n); ed.urls.push(u); nh = '<img src="' + u + '" alt="">'; }
      const typ = ed.typy[a.id] || a.typ;
      const sm = ed.smazane.has(a.id);
      return '<div class="pril' + (cek ? ' cekajici' : '') + (sm ? ' odebrana' : '') + '" data-pid="' + esc(a.id) + '">' +
        '<div class="nh" data-otevrit title="Otevřít">' + nh + '</div><div class="jm">' + esc(a.nazev) + '</div>' +
        '<div class="faint">' + J.velikost(a.velikost) + (cek ? ' · neuloženo' : '') + '</div>' +
        '<select data-typ aria-label="Druh přílohy">' + J.TYPY_PRILOH.map(t => '<option value="' + t + '"' + (t === typ ? ' selected' : '') + '>' + J.NAZVY_PRILOH[t] + '</option>').join('') + '</select>' +
        '<div class="rada"><button type="button" class="maly" data-stahnout title="Stáhnout">⬇</button>' +
        (sm ? '<button type="button" class="maly" data-vratit>Vrátit</button>' : '<button type="button" class="maly nebezpecne" data-odebrat>Odebrat</button>') + '</div></div>';
    }).join('');
  }
  async function blobPrilohy(id) {
    const n = ed && ed.nove.find(a => a.id === id); if (n) return n;
    return DB.priloha(id);
  }
  $('pPrilohy').addEventListener('change', e => { const s = e.target.closest('[data-typ]'); if (s) ed.typy[s.closest('.pril').dataset.pid] = s.value; });
  $('pPrilohy').addEventListener('click', async e => {
    const el = e.target.closest('.pril'); if (!el) return;
    const id = el.dataset.pid;
    if (e.target.closest('[data-odebrat]')) {
      const cek = ed.nove.findIndex(a => a.id === id);
      if (cek >= 0) ed.nove.splice(cek, 1);
      else if (await Dialog.potvrd('Odebrat přílohu? Smaže se trvale až po uložení položky; do té doby ji lze vrátit.', { ok: 'Odebrat' })) ed.smazane.add(id);
      vykresliPrilohyEditoru(); return;
    }
    if (e.target.closest('[data-vratit]')) { ed.smazane.delete(id); vykresliPrilohyEditoru(); return; }
    const a = await blobPrilohy(id); if (!a || !a.blob) { chyba('Soubor přílohy chybí.'); return; }
    if (e.target.closest('[data-stahnout]')) { stahni(a.blob, a.nazev); return; }
    if (e.target.closest('[data-otevrit]')) otevriPrilohu(a);
  });
  function otevriPrilohu(a) {
    const u = URL.createObjectURL(a.blob);
    if (/^image\//.test(a.mime)) {
      $('nahledTitulek').textContent = a.nazev;
      $('nahledVelky').innerHTML = '<img alt="">'; $('nahledVelky').querySelector('img').src = u;
      $('dlgNahled').showModal();
      $('dlgNahled').addEventListener('close', () => URL.revokeObjectURL(u), { once: true });
    } else {
      const w = window.open(u, '_blank', 'noopener');
      if (!w) stahni(a.blob, a.nazev);
      setTimeout(() => URL.revokeObjectURL(u), 120000);
    }
  }
  function odhadTypu(f) {
    const n = J.bezDiakritiky(f.name);
    if (/uctenk|faktur|doklad|receipt|invoice|paragon/.test(n)) return 'uctenka';
    if (/navod|manual|prirucka|guide|instrukc/.test(n)) return 'navod';
    if (/servis|oprav|reklamac|protokol/.test(n)) return 'servis';
    if (/^image\//.test(f.type)) return 'foto';
    return f.type === 'application/pdf' ? 'navod' : 'jine';
  }
  async function platno(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  const naBlob = (c, typ, q) => new Promise(ok => c.toBlob(ok, typ, q));
  /* Zmenšení fotky a náhled. Formáty, které prohlížeč nedekóduje (např. HEIC), se uloží beze změny a bez náhledu. */
  async function zpracujObrazek(f, max) {
    let bmp;
    try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch (e) { return { blob: f, nahled: null, zmenseno: false }; }
    let blob = f, zmenseno = false, nazev = f.name;
    const delsi = Math.max(bmp.width, bmp.height);
    if (max > 0 && delsi > max && /^image\/(jpeg|png|webp|bmp)$/.test(f.type)) {
      const k = max / delsi, c = await platno(Math.round(bmp.width * k), Math.round(bmp.height * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const b = await naBlob(c, 'image/jpeg', 0.86);
      if (b && b.size < f.size) { blob = b; zmenseno = true; nazev = f.name.replace(/\.[^.]+$/, '') + '.jpg'; }
    }
    const k2 = Math.min(1, 320 / delsi), c2 = await platno(Math.max(1, Math.round(bmp.width * k2)), Math.max(1, Math.round(bmp.height * k2)));
    const g2 = c2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height); g2.drawImage(bmp, 0, 0, c2.width, c2.height);
    const nahled = await naBlob(c2, 'image/jpeg', 0.8);
    if (bmp.close) bmp.close();
    return { blob, nahled, zmenseno, nazev };
  }
  async function pridejSoubory(soubory) {
    soubory = [...soubory]; if (!soubory.length || !ed) return;
    const celkem = soubory.reduce((s, f) => s + f.size, 0);
    const u = await DB.odhad();
    if (u.quota && u.usage != null && celkem > (u.quota - u.usage) * 0.9) {
      chyba('Na soubory (' + J.velikost(celkem) + ') není v úložišti místo – volno asi ' + J.velikost(u.quota - u.usage) + '.'); return;
    }
    const velke = soubory.filter(f => f.size > 50 * 1024 * 1024);
    if (velke.length && !await Dialog.potvrd('Soubor ' + velke[0].name + ' má ' + J.velikost(velke[0].size) + '. Velké přílohy zpomalují zálohu a zabírají úložiště. Přesto přidat?', { ok: 'Přidat' })) return;
    let zmens = 0;
    for (const f of soubory) {
      const typ = odhadTypu(f);
      let blob = f, nahled = null, nazev = f.name;
      if (/^image\//.test(f.type)) { const r = await zpracujObrazek(f, typ === 'foto' ? nast().fotoMax : 0); blob = r.blob; nahled = r.nahled; nazev = r.nazev || f.name; if (r.zmenseno) zmens++; }
      ed.nove.push({ id: J.novyId('A'), polozkaId: ed.id || '', typ, nazev, mime: blob.type || f.type || 'application/octet-stream', velikost: blob.size, vytvoreno: Date.now(), blob, nahled });
    }
    vykresliPrilohyEditoru();
    if (zmens) info('Zmenšeno fotografií: ' + zmens + ' (delší strana ' + nast().fotoMax + ' px).');
  }
  $('pSoubory').addEventListener('change', e => { pridejSoubory(e.target.files); e.target.value = ''; });
  $('pFoto').addEventListener('change', e => { pridejSoubory(e.target.files); e.target.value = ''; });
  dlgP.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  dlgP.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); pridejSoubory(e.dataTransfer.files); } });

  $('formPolozka').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('pNazev').value.trim()) { $('pNazev').classList.add('chyba'); $('pNazev').focus(); chyba('Vyplňte název položky.'); return; }
    $('pNazev').classList.remove('chyba');
    const h = hodnotyFormulare();
    if (h.cena.trim() && J.cislo(h.cena) == null) { $('pCena').classList.add('chyba'); $('pCena').focus(); chyba('Cenu se nepodařilo přečíst – zadejte číslo, např. 12 490,50.'); return; }
    if (h.datumPrevzeti && h.datumNakupu && h.datumPrevzeti < h.datumNakupu && !await Dialog.potvrd('Datum převzetí je dřív než datum nákupu. Přesto uložit?', { ok: 'Uložit' })) return;
    const ted = Date.now();
    const id = ed.id || J.novyId('M');
    if (!ed.id && S.polozky.some(p => p.id === id)) { chyba('Kolize identifikátoru, zkuste uložit znovu.'); return; }
    const p = J.normPolozka(Object.assign({}, ed.puvodni || {}, h, { id, vytvoreno: ed.puvodni ? ed.puvodni.vytvoreno : ted, upraveno: ted, smazano: ed.puvodni ? ed.puvodni.smazano : null }), ted);
    const nove = ed.nove.map(a => Object.assign({}, a, { polozkaId: id, typ: ed.typy[a.id] || a.typ }));
    const zmenene = S.prilohy.filter(a => a.polozkaId === id && ed.typy[a.id] && ed.typy[a.id] !== a.typ && !ed.smazane.has(a.id));
    const zmeneneCele = [];
    for (const a of zmenene) { const c = await DB.priloha(a.id); if (c) zmeneneCele.push(Object.assign(c, { typ: ed.typy[a.id] })); }
    if (await zapis(() => DB.ulozPolozku(p, nove.concat(zmeneneCele), [...ed.smazane]))) {
      info(ed.id ? 'Uloženo.' : 'Položka ' + id + ' založena.');
      await zavritEditor(true); await obnovVse(true); vykresliUpozorneni();
    }
  });
  $('pSmazat').addEventListener('click', async () => {
    const p = ed && ed.puvodni; if (!p) return;
    const ted = Date.now();
    if (p.smazano) {
      if (await zapis(() => DB.uloz('polozky', Object.assign({}, p, { smazano: null, upraveno: ted })))) { info('Obnoveno z koše.'); await zavritEditor(true); await obnovVse(true); }
      return;
    }
    if (otisk() !== ed.otisk && !await Dialog.potvrd('Máte neuložené změny. Přesunout položku do koše bez nich?', { ok: 'Do koše' })) return;
    if (!await Dialog.potvrd('Přesunout „' + p.nazev + '“ do koše? Položku i přílohy lze z koše obnovit.', { ok: 'Do koše' })) return;
    if (await zapis(() => DB.uloz('polozky', Object.assign({}, p, { smazano: ted, upraveno: ted })))) {
      vybrane.delete(p.id); info('Přesunuto do koše.'); await zavritEditor(true); await obnovVse(true); vykresliUpozorneni();
    }
  });
  $('pDuplikat').addEventListener('click', async () => {
    if (!ed || !ed.puvodni) return;
    if (otisk() !== ed.otisk && !await Dialog.potvrd('Neuložené změny se do kopie převezmou, původní položka zůstane beze změny. Pokračovat?', { ok: 'Duplikovat' })) return;
    const h = hodnotyFormulare();
    await zavritEditor(true);
    otevriEditor(null, Object.assign(J.normPolozka(h), { id: '', nazev: h.nazev + ' (kopie)', seriove: '', servis: [] }));
    info('Kopie bez sériového čísla, servisu a příloh – po kontrole uložte.');
  });
  $('pStitek').addEventListener('click', async () => { const id = ed.id; await zavritEditor(); if (ed) return; vybrane.clear(); vybrane.add(id); $('sZdroj').value = 'vybrane'; prepni('stitky'); });
  $('pIcs').addEventListener('click', () => { const p = ed && ed.puvodni; if (p) exportIcs([J.normPolozka(Object.assign({}, p, hodnotyFormulare()))]); });
  $('btnNova').addEventListener('click', () => otevriEditor(null));
  for (const d of ['dlgNahled', 'dlgObnova']) $(d).querySelectorAll('[data-zavrit]').forEach(b => b.addEventListener('click', () => $(d).close()));

  /* ---------- přehled hodnoty ---------- */
  function tabulkaSouhrnu(sh, popis) {
    if (!sh.radky.length) return '<p class="muted">Zatím žádné položky.</p>';
    const max = Math.max(...sh.radky.map(r => r.hodnota), 1);
    return '<table><thead><tr><th>' + popis + '</th><th class="c">Ks</th><th class="c">Hodnota</th><th class="c">Podíl</th><th class="sloupec-graf" aria-hidden="true"></th></tr></thead><tbody>' +
      sh.radky.map(r => '<tr><td>' + esc(r.nazev) + (r.bezCeny ? ' <span class="faint">(' + r.bezCeny + ' bez ceny)</span>' : '') + '</td><td class="c">' + r.pocet + '</td><td class="c">' + J.formatKc(r.hodnota, 0) +
        '</td><td class="c">' + J.formatCislo(r.podil * 100, 1) + ' %</td><td class="sloupec-graf"><div class="bar" style="width:' + (r.hodnota / max * 100).toFixed(1) + '%"></div></td></tr>').join('') +
      '</tbody><tfoot><tr><th>Celkem</th><th class="c">' + sh.pocet + '</th><th class="c">' + J.formatKc(sh.celkem, 0) + '</th><th class="c">100 %</th><th></th></tr></tfoot></table>';
  }
  function vykresliPrehled() {
    const sk = J.souhrn(S.polozky, ctx), sl = J.souhrn(S.polozky, ctx, 'lokalita');
    const akt = S.polozky.filter(p => !p.smazano);
    const st = { platna: 0, konci: 0, prosla: 0, bez: 0 }; let vZaruce = 0;
    for (const p of akt) { const s = J.stavZaruky(p, dnes, nast().upozornitDni).stav; st[s]++; if (s === 'platna' || s === 'konci') vZaruce += p.cena || 0; }
    const velPril = S.prilohy.reduce((s, a) => s + (a.velikost || 0), 0);
    const servis = akt.reduce((s, p) => s + (p.servis || []).reduce((t, z) => t + (z.cena || 0), 0), 0);
    const uk = [[J.formatKc(sk.celkem, 0), 'pořizovací hodnota celkem'], [sk.pocet, 'položek v evidenci' + (sk.bezCeny ? ' (' + sk.bezCeny + ' bez ceny)' : '')],
      [J.formatKc(vZaruce, 0), 'hodnota věcí v záruce'], [st.konci, 'záruk brzy končí'], [S.prilohy.filter(a => akt.some(p => p.id === a.polozkaId)).length + ' / ' + J.velikost(velPril), 'příloh / jejich velikost'], [J.formatKc(servis, 0), 'náklady na servis']];
    $('ukazatele').innerHTML = uk.map(([h, n]) => '<div class="ukazatel"><div class="h">' + h + '</div><div class="n">' + n + '</div></div>').join('');
    $('prehledKat').innerHTML = tabulkaSouhrnu(sk, 'Kategorie');
    $('prehledLok').innerHTML = tabulkaSouhrnu(sl, 'Lokalita');
    const zr = [['platna', 'platná'], ['konci', 'končí do ' + nast().upozornitDni + ' dní'], ['prosla', 'prošlá'], ['bez', 'bez údaje']];
    $('prehledZaruk').innerHTML = '<table><tbody>' + zr.map(([k, n]) => '<tr><td><span class="zaruka ' + k + '">' + n + '</span></td><td class="c">' + st[k] + '</td><td><button class="maly" data-zaruka="' + k + '">zobrazit</button></td></tr>').join('') + '</tbody></table>';
    const top = J.serad(akt.filter(p => p.cena != null), 'cena', ctx).slice(0, 8);
    $('prehledTop').innerHTML = top.length ? '<table><tbody>' + top.map(p => '<tr><td><button class="maly" data-otevri="' + esc(p.id) + '">' + esc(p.nazev) + '</button></td><td class="faint">' + esc((ctx.kat.get(p.kategorieId) || {}).nazev || '') + '</td><td class="c">' + J.formatKc(p.cena, 0) + '</td></tr>').join('') + '</tbody></table>' : '<p class="muted">Žádná položka nemá cenu.</p>';
  }
  $('list-prehled').addEventListener('click', e => {
    const z = e.target.closest('[data-zaruka]');
    if (z) { $('btnZrusFiltry').click(); $('fZaruka').value = z.dataset.zaruka; ulozFiltry(); prepni('polozky'); return; }
    const o = e.target.closest('[data-otevri]'); if (o) otevriEditor(o.dataset.otevri);
  });

  /* ---------- štítky ---------- */
  $('sArch').innerHTML = Object.entries(ST.ARCHY).map(([k, a]) => '<option value="' + k + '">' + esc(a.nazev) + '</option>').join('');
  (function () { const o = lsCti('stitky', {}); for (const id of ['sArch', 'sObsahQr', 'sNazev', 'sMisto', 'sVyrobce', 'sSeriove']) if (o[id] != null) { if ($(id).type === 'checkbox') $(id).checked = o[id]; else $(id).value = o[id]; } })();
  for (const id of ['sZdroj', 'sArch', 'sPreskocit', 'sObsahQr', 'sNazev', 'sMisto', 'sVyrobce', 'sSeriove']) $(id).addEventListener(id === 'sPreskocit' ? 'input' : 'change', () => {
    const o = {}; for (const k of ['sArch', 'sObsahQr', 'sNazev', 'sMisto', 'sVyrobce', 'sSeriove']) o[k] = $(k).type === 'checkbox' ? $(k).checked : $(k).value; lsPis('stitky', o);
    vykresliStitky();
  });
  function polozkyStitku() {
    const z = $('sZdroj').value;
    if (z === 'vybrane') return J.serad(S.polozky.filter(p => vybrane.has(p.id) && !p.smazano), 'misto', ctx);
    if (z === 'filtr') return zobrazene();
    return J.serad(S.polozky.filter(p => !p.smazano), 'misto', ctx);
  }
  const qrCache = new Map();
  function qrProText(t) {
    if (!qrCache.has(t)) { if (qrCache.size > 3000) qrCache.clear(); qrCache.set(t, ST.qrSvg(ST.qrMatice(t, window.qrcode, 'M'), 2)); }
    return qrCache.get(t);
  }
  function sestavArchy(pol) {
    const arch = ST.ARCHY[$('sArch').value], st = ST.rozloz(arch, pol.length, +$('sPreskocit').value || 0);
    const odkaz = $('sObsahQr').value === 'odkaz' ? location.href : '';
    const h = arch.h, q = Math.min(h - 4, arch.w * 0.46);
    const fId = Math.min(3.2, h * 0.1), fNz = Math.min(3.6, h * 0.105), fMi = Math.min(2.9, h * 0.085);
    const maloMista = h < 25;
    return st.map(stranka => '<div class="arch">' + stranka.map(c => {
      const p = pol[c.i];
      const r = [];
      r.push('<div class="id" style="font-size:' + fId.toFixed(2) + 'mm">' + esc(p.id) + '</div>');
      if ($('sNazev').checked) r.push('<div class="nz" style="font-size:' + fNz.toFixed(2) + 'mm' + (maloMista ? ';-webkit-line-clamp:1' : '') + '">' + esc(p.nazev) + '</div>');
      if (!maloMista) {
        if ($('sMisto').checked) { const m = J.nazevMista(p, ctx); if (m) r.push('<div class="mi" style="font-size:' + fMi.toFixed(2) + 'mm">' + esc(m) + '</div>'); }
        if ($('sVyrobce').checked && (p.vyrobce || p.model)) r.push('<div class="vl" style="font-size:' + fMi.toFixed(2) + 'mm">' + esc([p.vyrobce, p.model].filter(Boolean).join(' ')) + '</div>');
        if ($('sSeriove').checked && p.seriove) r.push('<div class="vl" style="font-size:' + fMi.toFixed(2) + 'mm">SN ' + esc(p.seriove) + '</div>');
      }
      return '<div class="etiketa" style="left:' + c.x + 'mm;top:' + c.y + 'mm;width:' + c.w + 'mm;height:' + c.h + 'mm">' +
        '<div class="qr" style="width:' + q.toFixed(2) + 'mm;height:' + q.toFixed(2) + 'mm">' + qrProText(J.textQr(p.id, odkaz)) + '</div><div class="txt">' + r.join('') + '</div></div>';
    }).join('') + '</div>');
  }
  function vykresliStitky() {
    const pol = polozkyStitku();
    const arch = ST.ARCHY[$('sArch').value];
    const naArch = arch.sl * arch.ra;
    $('sPreskocit').max = naArch - 1;
    if (!pol.length) {
      $('sInfo').textContent = $('sZdroj').value === 'vybrane' ? 'Nejsou vybrané žádné položky – zaškrtněte je v seznamu, nebo zvolte jiný zdroj.' : 'Žádné položky.';
      $('archNahled').innerHTML = ''; $('btnTisk').disabled = true; return;
    }
    $('btnTisk').disabled = false;
    const archy = sestavArchy(pol.slice(0, 300));
    $('sInfo').textContent = pol.length + ' ' + sklon(pol.length, 'štítek', 'štítky', 'štítků') + ' na ' + Math.ceil((pol.length + (+$('sPreskocit').value || 0)) / naArch) + ' ' + sklon(Math.ceil((pol.length + (+$('sPreskocit').value || 0)) / naArch), 'arch', 'archy', 'archů') + ' A4' + (pol.length > 300 ? ' (náhled ukazuje prvních 300, tisknou se všechny)' : '') + '.';
    const sirka = Math.max(200, $('archNahled').clientWidth - 24);
    const pxA4 = 210 * 96 / 25.4, k = Math.min(1, sirka / pxA4);
    $('archNahled').innerHTML = archy.slice(0, 3).map(a => '<div style="width:' + (pxA4 * k).toFixed(0) + 'px;height:' + (297 * 96 / 25.4 * k).toFixed(0) + 'px;margin:0 auto 10px">' +
      a.replace('<div class="arch">', '<div class="arch" style="transform:scale(' + k.toFixed(4) + ')">') + '</div>').join('') +
      (archy.length > 3 ? '<p class="faint" style="text-align:center">… a další ' + (archy.length - 3) + ' ' + sklon(archy.length - 3, 'arch', 'archy', 'archů') + '</p>' : '');
  }
  $('btnTisk').addEventListener('click', () => {
    const pol = polozkyStitku(); if (!pol.length) return;
    $('tisk').innerHTML = sestavArchy(pol).join('');
    document.body.classList.add('tisk-stitky');
    const konec = () => { document.body.classList.remove('tisk-stitky'); $('tisk').innerHTML = ''; };
    window.addEventListener('afterprint', konec, { once: true });
    window.print();
  });
  let casResize = 0;
  window.addEventListener('resize', () => { clearTimeout(casResize); casResize = setTimeout(() => { if (aktivni === 'stitky') vykresliStitky(); }, 200); });

  /* ---------- číselníky ---------- */
  function pocetPouziti(kde, id) {
    return S.polozky.filter(p => kde === 'kategorie' ? p.kategorieId === id : kde === 'mistnosti' ? p.mistnostId === id
      : (p.lokalitaId === id || S.mistnosti.some(m => m.id === p.mistnostId && m.lokalitaId === id))).length;
  }
  function radekCis(kde, x) {
    const n = pocetPouziti(kde, x.id);
    return '<li data-kde="' + kde + '" data-id="' + esc(x.id) + '"><span class="jm">' + esc(x.nazev) + ' <span class="faint">' + n + ' ks</span></span>' +
      (kde === 'mistnosti' ? '<button class="maly" data-presun>Přesunout</button>' : '') +
      '<button class="maly" data-filtr>Položky</button><button class="maly" data-prejmenovat>Přejmenovat</button><button class="maly nebezpecne" data-smazat aria-label="Smazat ' + esc(x.nazev) + '">Smazat</button></li>';
  }
  function vykresliCiselniky() {
    let h = '';
    for (const l of serazene(S.lokality)) h += '<ul>' + radekCis('lokality', l).replace('<span class="jm">', '<span class="jm"><b>🏠 ').replace('</span></li>', '</span></li>').replace(' <span class="faint">', '</b> <span class="faint">') +
      mistnostiLokality(l.id).map(m => radekCis('mistnosti', m).replace('<span class="jm">', '<span class="jm" style="padding-left:18px">')).join('') + '</ul>';
    const bez = serazene(S.mistnosti.filter(m => !S.lokality.some(l => l.id === m.lokalitaId)));
    if (bez.length) h += '<div class="skupina">Místnosti bez lokality</div><ul>' + bez.map(m => radekCis('mistnosti', m)).join('') + '</ul>';
    $('cisMista').innerHTML = h || '<p class="muted">Zatím žádné lokality.</p>';
    $('cisKat').innerHTML = serazene(S.kategorie).map(k => radekCis('kategorie', k)).join('') || '<li class="muted">Žádné kategorie.</li>';
    const st = vsechnyStitky();
    $('cisStitky').innerHTML = st.length ? st.map(s => '<button class="maly" data-stitek="' + esc(s.nazev) + '" style="margin:2px">' + esc(s.nazev) + ' <span class="faint">' + s.pocet + '</span></button>').join('') : '<p class="muted">Zatím žádné štítky.</p>';
  }
  const JEDN = { lokality: 'lokalitu', mistnosti: 'místnost', kategorie: 'kategorii' };
  async function novyZaznam(kde, extra) {
    const nazev = await Dialog.zeptej('Název – ' + JEDN[kde] + ':', '', { ok: 'Přidat' });
    if (nazev == null || !nazev.trim()) return null;
    const t = nazev.trim().slice(0, 120);
    if (S[kde].some(x => J.bezDiakritiky(x.nazev) === J.bezDiakritiky(t) && (kde !== 'mistnosti' || x.lokalitaId === (extra || {}).lokalitaId))) { chyba('„' + t + '“ už existuje.'); return null; }
    const z = Object.assign({ id: J.novyId(kde === 'lokality' ? 'L' : kde === 'mistnosti' ? 'R' : 'K'), nazev: t }, extra || {});
    if (await zapis(() => DB.uloz(kde, z))) { await obnovVse(true); return z; }
    return null;
  }
  $('btnNovaLok').addEventListener('click', () => novyZaznam('lokality', { adresa: '' }));
  $('btnNovaKat').addEventListener('click', () => novyZaznam('kategorie'));
  $('btnNovaMist').addEventListener('click', async () => {
    let lid = '';
    if (S.lokality.length === 1) lid = S.lokality[0].id;
    else if (S.lokality.length > 1) {
      const l = await vyberLokality('Do které lokality místnost patří?'); if (l === null) return; lid = l;
    }
    novyZaznam('mistnosti', { lokalitaId: lid });
  });
  function vyberLokality(otazka, vychozi) {
    return new Promise(ok => {
      const d = document.createElement('dialog'); d.className = 'okno'; d.style.width = 'min(420px, calc(100vw - 16px))';
      d.innerHTML = '<div class="hlava"><h2>' + esc(otazka) + '</h2></div><div class="telo"><select style="margin-top:8px">' +
        serazene(S.lokality).map(l => '<option value="' + esc(l.id) + '">' + esc(l.nazev) + '</option>').join('') + '<option value="">— bez lokality —</option></select></div>' +
        '<div class="pata"><button class="hlavni" data-ok>Vybrat</button><button data-zrus>Zrušit</button></div>';
      document.body.appendChild(d);
      const sel = d.querySelector('select'); if (vychozi != null) sel.value = vychozi;
      const konec = v => { d.close(); d.remove(); ok(v); };
      d.querySelector('[data-ok]').onclick = () => konec(sel.value); d.querySelector('[data-zrus]').onclick = () => konec(null);
      d.addEventListener('cancel', e => { e.preventDefault(); konec(null); });
      d.showModal();
    });
  }
  $('list-ciselniky').addEventListener('click', async e => {
    const s = e.target.closest('[data-stitek]');
    if (s) { $('btnZrusFiltry').click(); $('fStitek').value = s.dataset.stitek; ulozFiltry(); prepni('polozky'); return; }
    const li = e.target.closest('li[data-kde]'); if (!li) return;
    const kde = li.dataset.kde, id = li.dataset.id, x = S[kde].find(z => z.id === id); if (!x) return;
    if (e.target.closest('[data-filtr]')) {
      $('btnZrusFiltry').click();
      if (kde === 'kategorie') $('fKategorie').value = id;
      else if (kde === 'lokality') { $('fLokalita').value = id; moznosti($('fMistnost'), mistnostiLokality(id), 'všechny'); }
      else { $('fLokalita').value = x.lokalitaId || ''; moznosti($('fMistnost'), mistnostiLokality(x.lokalitaId), 'všechny'); $('fMistnost').value = id; }
      ulozFiltry(); prepni('polozky'); return;
    }
    if (e.target.closest('[data-prejmenovat]')) {
      const n = await Dialog.zeptej('Nový název:', x.nazev, { ok: 'Přejmenovat' });
      if (n && n.trim() && n.trim() !== x.nazev && await zapis(() => DB.uloz(kde, Object.assign({}, x, { nazev: n.trim().slice(0, 120) })))) await obnovVse(true);
      return;
    }
    if (e.target.closest('[data-presun]')) {
      const l = await vyberLokality('Přesunout „' + x.nazev + '“ do lokality', x.lokalitaId); if (l === null) return;
      const ted = Date.now();
      const pol = S.polozky.filter(p => p.mistnostId === id).map(p => Object.assign({}, p, { lokalitaId: l, upraveno: ted }));
      if (await zapis(async () => { await DB.uloz('mistnosti', Object.assign({}, x, { lokalitaId: l })); if (pol.length) await DB.uloz('polozky', pol); })) await obnovVse(true);
      return;
    }
    if (e.target.closest('[data-smazat]')) {
      const n = pocetPouziti(kde, id);
      const podr = kde === 'lokality' ? S.mistnosti.filter(m => m.lokalitaId === id).length : 0;
      let text = 'Smazat ' + JEDN[kde] + ' „' + x.nazev + '“?';
      if (n) text += ' ' + n + ' ' + sklon(n, 'položka ji používá', 'položky ji používají', 'položek ji používá') + ' – položky zůstanou, jen u nich údaj zmizí.';
      if (podr) text += ' Její místnosti (' + podr + ') zůstanou bez lokality.';
      if (!await Dialog.potvrd(text, { ok: 'Smazat' })) return;
      const ted = Date.now();
      const pol = S.polozky.filter(p => kde === 'kategorie' ? p.kategorieId === id : kde === 'mistnosti' ? p.mistnostId === id : p.lokalitaId === id)
        .map(p => Object.assign({}, p, kde === 'kategorie' ? { kategorieId: '' } : kde === 'mistnosti' ? { mistnostId: '' } : { lokalitaId: '' }, { upraveno: ted }));
      const mist = kde === 'lokality' ? S.mistnosti.filter(m => m.lokalitaId === id).map(m => Object.assign({}, m, { lokalitaId: '' })) : [];
      if (await zapis(async () => { if (pol.length) await DB.uloz('polozky', pol); if (mist.length) await DB.uloz('mistnosti', mist); await DB.smaz(kde, id); })) { info('Smazáno.'); await obnovVse(true); }
    }
  });

  /* ---------- koš ---------- */
  function vykresliKos() {
    uvolniUrl();
    const pol = S.polozky.filter(p => p.smazano).sort((a, b) => b.smazano - a.smazano);
    $('btnVysypat').disabled = !pol.length;
    $('seznamKos').innerHTML = pol.length ? pol.map(p => radekPolozky(p, null, true)).join('') : '<p class="prazdne">Koš je prázdný.</p>';
  }
  $('seznamKos').addEventListener('click', async e => {
    const r = e.target.closest('.pol'); if (!r) return;
    const p = S.polozky.find(x => x.id === r.dataset.id); if (!p) return;
    if (e.target.closest('[data-obnovit]')) {
      if (await zapis(() => DB.uloz('polozky', Object.assign({}, p, { smazano: null, upraveno: Date.now() })))) { info('„' + p.nazev + '“ obnoveno.'); await obnovVse(true); vykresliUpozorneni(); }
    } else if (e.target.closest('[data-trvale]')) {
      const np = S.prilohy.filter(a => a.polozkaId === p.id).length;
      if (!await Dialog.potvrd('Trvale smazat „' + p.nazev + '“' + (np ? ' včetně ' + np + ' ' + sklon(np, 'přílohy', 'příloh', 'příloh') : '') + '? Tento krok nelze vrátit.', { ok: 'Smazat trvale' })) return;
      if (await zapis(() => DB.smazTrvale([p.id]))) { info('Trvale smazáno.'); await obnovVse(true); }
    } else otevriEditor(p.id);
  });
  $('btnVysypat').addEventListener('click', async () => {
    const ids = S.polozky.filter(p => p.smazano).map(p => p.id); if (!ids.length) return;
    if (!await Dialog.potvrd('Trvale smazat všech ' + ids.length + ' ' + sklon(ids.length, 'položku', 'položky', 'položek') + ' z koše včetně příloh? Tento krok nelze vrátit.', { ok: 'Vysypat koš' })) return;
    if (await zapis(() => DB.smazTrvale(ids))) { info('Koš vysypán.'); await obnovVse(true); }
  });

  /* ---------- záloha, obnova, úložiště ---------- */
  async function sestavZalohu() {
    const all = await Promise.all(['prilohy'].map(s => DB.vse(s)));
    const prilohy = all[0];
    const soubory = [], meta = [];
    const pouzita = new Set();
    for (const a of prilohy) {
      let jm = 'prilohy/' + J.bezpecneJmeno(a.polozkaId) + '/' + a.id + '_' + J.bezpecneJmeno(a.nazev);
      while (pouzita.has(jm)) jm += '_';
      pouzita.add(jm);
      const m = { id: a.id, polozkaId: a.polozkaId, typ: a.typ, nazev: a.nazev, mime: a.mime, velikost: a.velikost, vytvoreno: a.vytvoreno, soubor: jm };
      if (a.blob) soubory.push({ name: jm, data: new Uint8Array(await a.blob.arrayBuffer()) });
      if (a.nahled) { m.nahledSoubor = 'nahledy/' + a.id + '.jpg'; soubory.push({ name: m.nahledSoubor, data: new Uint8Array(await a.nahled.arrayBuffer()) }); }
      meta.push(m);
    }
    const data = { aplikace: 'evidence-majetku', schema: J.SCHEMA, vytvoreno: new Date().toISOString(),
      polozky: S.polozky, lokality: S.lokality, mistnosti: S.mistnosti, kategorie: S.kategorie, prilohy: meta, nastaveni: S.nastaveni };
    const csvAkt = J.csv(J.serad(S.polozky.filter(p => !p.smazano), 'nazev', ctx), ctx, dnes, nast().upozornitDni, pocetPriloh());
    const precti = 'Záloha Evidence domácího majetku (' + new Date().toLocaleString('cs-CZ') + ')\r\n\r\n' +
      'data.json   – všechna data (schéma ' + J.SCHEMA + '), obnova: stránka Evidence majetku → Záloha a úložiště → Obnova ze zálohy\r\n' +
      'seznam.csv  – seznam položek pro Excel (UTF-8, středník)\r\nprilohy/    – originální soubory příloh podle ID položky\r\nnahledy/    – zmenšené náhledy fotografií\r\n';
    return J.zapisZip([{ name: 'data.json', data: JSON.stringify(data, null, 1) }, { name: 'seznam.csv', data: csvAkt }, { name: 'PRECTI.txt', data: precti }].concat(soubory), new Date());
  }
  async function stahniZalohu() {
    const b = $('btnZaloha'); b.disabled = true; const t = b.textContent; b.textContent = 'Připravuji zálohu…';
    try {
      const casti = await sestavZalohu();
      const blob = new Blob(casti, { type: 'application/zip' });
      stahni(blob, 'majetek_zaloha_' + dnes + '.zip');
      await DB.nastavMeta('posledniZaloha', Date.now()); S.posledniZaloha = Date.now();
      info('Záloha stažena (' + J.velikost(blob.size) + '). Uložte ji mimo tento počítač, např. na disk v cloudu nebo USB.');
      vykresliUpozorneni(); if (aktivni === 'zaloha') vykresliZalohu();
      return true;
    } catch (e) { chyba('Zálohu se nepodařilo vytvořit: ' + DB.popisChyby(e)); console.error(e); return false; }
    finally { b.disabled = false; b.textContent = t; }
  }
  $('btnZaloha').addEventListener('click', stahniZalohu);

  let obnova = null;
  $('souborObnova').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const u8 = new Uint8Array(await f.arrayBuffer());
      let surova, soubory = new Map();
      if (u8[0] === 0x50 && u8[1] === 0x4b) {
        const zip = await J.ctiZip(u8);
        for (const z of zip) soubory.set(z.name, z.data);
        const dj = soubory.get('data.json'); if (!dj) throw new Error('V ZIPu chybí data.json – nejde o zálohu této aplikace.');
        surova = JSON.parse(new TextDecoder().decode(dj));
      } else surova = JSON.parse(new TextDecoder().decode(u8).replace(/^﻿/, ''));
      const mg = J.migruj(surova, Date.now());
      const chybi = [];
      for (const a of mg.data.prilohy) {
        const d = a.soubor && soubory.get(a.soubor);
        if (d) a.blob = new Blob([d], { type: a.mime }); else chybi.push(a.nazev);
        const n = a.nahledSoubor && soubory.get(a.nahledSoubor);
        a.nahled = n ? new Blob([n], { type: 'image/jpeg' }) : null;
        delete a.soubor; delete a.nahledSoubor;
      }
      mg.data.prilohy = mg.data.prilohy.filter(a => a.blob);
      const vel = mg.data.prilohy.reduce((s, a) => s + a.blob.size, 0);
      obnova = { data: mg.data, vel };
      const plan = J.planSlouceni(S, mg.data);
      $('obnovaInfo').innerHTML = '<p>Soubor <b>' + esc(f.name) + '</b> (' + J.velikost(f.size) + ')' + (surova.vytvoreno ? ', vytvořen ' + esc(new Date(surova.vytvoreno).toLocaleString('cs-CZ')) : '') + '.</p>' +
        '<ul style="margin:6px 0 0 18px"><li>položek: <b>' + mg.data.polozky.length + '</b> (v koši ' + mg.data.polozky.filter(p => p.smazano).length + ')</li>' +
        '<li>lokalit ' + mg.data.lokality.length + ', místností ' + mg.data.mistnosti.length + ', kategorií ' + mg.data.kategorie.length + '</li>' +
        '<li>příloh: <b>' + mg.data.prilohy.length + '</b> (' + J.velikost(vel) + ')</li>' +
        (mg.kroky.length ? '<li>převedeno ze staršího formátu (' + mg.kroky.join(', ') + ')</li>' : '') + '</ul>' +
        (chybi.length ? '<p class="hlaseni chyba" style="margin-top:8px">V záloze chybí ' + chybi.length + ' ' + sklon(chybi.length, 'soubor přílohy', 'soubory příloh', 'souborů příloh') + ' – tyto přílohy se neobnoví.</p>' : '') +
        '<p style="margin-top:8px">Při sloučení: přibude ' + plan.polozky.pridat.length + ' položek, ' + plan.polozky.prepsat.length + ' se aktualizuje na novější verzi, ' + plan.polozky.ponechat + ' zůstane; přibude ' + plan.prilohy.pridat.length + ' příloh.</p>';
      $('dlgObnova').showModal();
    } catch (err) {
      console.error(err);
      chyba('Zálohu nelze načíst: ' + (err instanceof SyntaxError ? 'soubor není platný JSON.' : err.message));
    }
  });
  $('obnovaProvest').addEventListener('click', async () => {
    if (!obnova) return;
    const rezim = document.querySelector('input[name=obnovaRezim]:checked').value;
    const u = await DB.odhad();
    if (u.quota && u.usage != null && obnova.vel > (u.quota - u.usage) * 0.95 && rezim === 'sloucit') { chyba('Na přílohy ze zálohy není v úložišti dost místa.'); return; }
    if (rezim === 'nahradit' && !await Dialog.potvrd('Opravdu smazat všechna současná data (' + S.polozky.length + ' položek, ' + S.prilohy.length + ' příloh) a nahradit je zálohou?', { ok: 'Nahradit vše' })) return;
    if ($('obnovaZalohaPred').checked && S.polozky.length && !await stahniZalohu()) return;
    $('dlgObnova').close();
    const ok = await zapis(async () => {
      if (rezim === 'nahradit') await DB.nahradVse(Object.assign({}, obnova.data, { nastaveni: Object.assign({}, S.nastaveni, obnova.data.nastaveni) }));
      else await DB.sloucit(J.planSlouceni(S, obnova.data));
    });
    obnova = null;
    if (ok) { info(rezim === 'nahradit' ? 'Data byla nahrazena zálohou.' : 'Záloha byla sloučena s daty.'); skrytaUpozorneni = false; await obnovVse(true); vykresliUpozorneni(); }
  });

  async function vykresliZalohu() {
    const n = nast();
    $('nZaruka').value = n.vychoziZaruka; $('nPredem').value = n.upozornitDni; $('nFoto').value = n.fotoMax; $('nZalohaDni').value = n.zalohaDni;
    $('infoZaloha').innerHTML = S.posledniZaloha ? 'Poslední záloha z tohoto prohlížeče: <b>' + new Date(S.posledniZaloha).toLocaleString('cs-CZ') + '</b>.' : '<b>Zatím jste zálohu nestáhli.</b>';
    const u = await DB.odhad();
    const velPril = S.prilohy.reduce((s, a) => s + (a.velikost || 0) + (a.nahled ? a.nahled.size : 0), 0);
    let h = '';
    if (u.usage != null && u.quota) {
      const pod = u.usage / u.quota;
      h += '<div>Využito <b>' + J.velikost(u.usage) + '</b> z dostupných ' + J.velikost(u.quota) + ' (' + J.formatCislo(pod * 100, pod < 0.01 ? 2 : 1) + ' %).</div>' +
        '<div class="meridlo' + (pod > 0.8 ? ' plne' : '') + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (pod * 100).toFixed(1) + '"><div style="width:' + Math.max(0.5, pod * 100).toFixed(1) + '%"></div></div>' +
        '<div class="faint">Odhad prohlížeče (navigator.storage.estimate) zahrnuje celý web, nejen tuto stránku, a bývá zaokrouhlený.</div>';
    } else h += '<div>Prohlížeč neposkytuje odhad kapacity úložiště.</div>';
    h += '<div style="margin-top:6px">Přílohy této evidence: <b>' + J.velikost(velPril) + '</b> v ' + S.prilohy.length + ' ' + sklon(S.prilohy.length, 'souboru', 'souborech', 'souborech') + '.</div>';
    h += '<div style="margin-top:6px">Trvalé úložiště: ' + (u.trvale === true ? '<b style="color:var(--ok-text)">povoleno</b> – prohlížeč data sám nesmaže.' : u.trvale === false ? '<b style="color:var(--warn-text)">nepovoleno</b>.' : 'nezjištěno.') + '</div>';
    $('infoUloziste').innerHTML = h;
    $('btnTrvale').disabled = !u.podporaTrvale || u.trvale === true;
  }
  $('btnTrvale').addEventListener('click', async () => {
    const r = await DB.pozadatTrvale();
    if (r) info('Trvalé úložiště povoleno.');
    else chyba('Prohlížeč žádost odmítl. Chrome ji obvykle povolí u stránek přidaných na plochu nebo často navštěvovaných; ve Firefoxu se zobrazí dotaz.');
    vykresliZalohu();
  });
  $('btnObnovUloziste').addEventListener('click', vykresliZalohu);
  for (const [id, k, min, max] of [['nZaruka', 'vychoziZaruka', 0, 1200], ['nPredem', 'upozornitDni', 0, 365], ['nFoto', 'fotoMax', 0, 8000], ['nZalohaDni', 'zalohaDni', 0, 365]]) {
    $(id).addEventListener('change', async () => {
      let v = Math.round(Number($(id).value));
      if (!Number.isFinite(v) || v < min || v > max) { chyba('Zadejte číslo ' + min + '–' + max + '.'); $(id).value = nast()[k]; return; }
      S.nastaveni = Object.assign({}, S.nastaveni, { [k]: v });
      if (await zapis(() => DB.nastavMeta('nastaveni', S.nastaveni))) { info('Nastavení uloženo.'); vykresliUpozorneni(); }
    });
  }
  $('btnSmazVse').addEventListener('click', async () => {
    const t = await Dialog.zeptej('Smaže se úplně vše: ' + S.polozky.length + ' položek, ' + S.prilohy.length + ' příloh, místa i kategorie. Nelze to vrátit. Pro potvrzení napište SMAZAT.', '', { ok: 'Smazat vše' });
    if (t == null) return;
    if (t.trim().toUpperCase() !== 'SMAZAT') { chyba('Nic se nesmazalo – potvrzovací slovo nesouhlasí.'); return; }
    if (await zapis(() => DB.nahradVse({ polozky: [], prilohy: [], lokality: [], mistnosti: [], kategorie: [], nastaveni: S.nastaveni }))) {
      await prvniSpusteni(); vybrane.clear(); info('Všechna data smazána.'); await obnovVse(true); vykresliUpozorneni();
    }
  });

  /* ---------- ukázková data ---------- */
  async function obrazekUkazky(text, barva, uctenka) {
    const c = await platno(uctenka ? 360 : 480, uctenka ? 520 : 360), g = c.getContext('2d');
    g.fillStyle = uctenka ? '#fbfaf5' : barva; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = uctenka ? '#222' : '#fff'; g.textAlign = 'center';
    if (uctenka) {
      g.font = 'bold 22px sans-serif'; g.fillText('ÚČTENKA (ukázka)', 180, 50); g.font = '18px monospace'; g.textAlign = 'left';
      text.split('\n').forEach((r, i) => g.fillText(r, 30, 110 + i * 32));
    } else { g.font = 'bold 40px sans-serif'; g.fillText(text, 240, 190); }
    const blob = await naBlob(c, 'image/jpeg', 0.85);
    return blob;
  }
  async function vlozUkazku() {
    if (S.polozky.some(p => (p.stitky || []).includes('ukázka')) && !await Dialog.potvrd('Ukázková data už v evidenci jsou. Vložit je znovu?', { ok: 'Vložit' })) return;
    const kat = n => (S.kategorie.find(k => k.nazev === n) || {}).id || '';
    const mist = n => S.mistnosti.find(m => m.nazev === n) || {};
    const d = (mes, dny) => J.pridejDny(J.pridejMesice(dnes, mes), dny || 0);
    const ted = Date.now();
    const zakl = [
      ['Televize 55"', 'Samsung', 'QE55Q80C', 'TV7X1129AB', 18990, d(-24, 12), 'Alza.cz', 24, 'Elektronika', 'Obývací pokoj', ['dárek']],
      ['Pračka', 'Bosch', 'WAN28262BY', 'FD9912-00431', 11490, d(-14), 'Datart', 24, 'Velké spotřebiče', 'Koupelna', []],
      ['Notebook', 'Lenovo', 'ThinkPad T14 Gen 4', 'PF4XK2LM', 32990, d(-5), 'CZC.cz', 36, 'Elektronika', 'Pracovna', ['práce', 'pojištěno']],
      ['Lednice s mrazákem', 'Gorenje', 'NRK6202AXL4', '7712340098', 13990, d(-24, -10), 'Okay', 24, 'Velké spotřebiče', 'Kuchyně', []],
      ['Aku vrtačka', 'Makita', 'DHP482Z', '', 2890, d(-30), 'Hornbach', 24, 'Nářadí a dílna', 'Garáž', []],
      ['Horské kolo', 'Author', 'Solution 29', 'WSB21K09833', 24900, d(-8), 'Cyklo Kučera', 24, 'Sport a volný čas', 'Sklep', ['pojištěno']],
      ['Pohovka', 'IKEA', 'KIVIK', '', 15990, d(-40), 'IKEA', 120, 'Nábytek', 'Obývací pokoj', []],
      ['Snubní prsten', '', '', '', null, '', '', null, 'Šperky a cennosti', 'Ložnice', ['pojištěno']]
    ];
    const pol = zakl.map(([nazev, vyrobce, model, seriove, cena, datumNakupu, prodejce, zarukaMesice, k, m, st], i) => J.normPolozka({
      id: J.novyId('M'), nazev, vyrobce, model, seriove, cena, datumNakupu, prodejce, zarukaMesice, kategorieId: kat(k),
      mistnostId: mist(m).id || '', lokalitaId: mist(m).lokalitaId || '', stitky: st.concat('ukázka'), vytvoreno: ted - i, upraveno: ted - i,
      servis: nazev === 'Pračka' ? [{ id: J.novyId('S'), datum: d(-3), popis: 'Výměna těsnění dvířek', dodavatel: 'Servis Bosch', cena: 890 }] : []
    }, ted));
    const pril = [];
    const barvy = ['#2d5d8a', '#3f7d4e', '#7a4a8c', '#8a5a2d'];
    for (let i = 0; i < 4; i++) {
      const foto = await obrazekUkazky(pol[i].nazev, barvy[i]);
      const nh = await zpracujObrazek(new File([foto], 'foto.jpg', { type: 'image/jpeg' }), 0);
      pril.push({ id: J.novyId('A'), polozkaId: pol[i].id, typ: 'foto', nazev: 'foto_' + J.bezpecneJmeno(pol[i].nazev) + '.jpg', mime: 'image/jpeg', velikost: foto.size, vytvoreno: ted, blob: foto, nahled: nh.nahled });
    }
    const uc = await obrazekUkazky(pol[0].prodejce + '\n' + J.formatDatum(pol[0].datumNakupu) + '\n\n' + pol[0].nazev + '\n' + J.formatKc(pol[0].cena) + '\n\nDPH 21 %', '', true);
    pril.push({ id: J.novyId('A'), polozkaId: pol[0].id, typ: 'uctenka', nazev: 'uctenka_televize.jpg', mime: 'image/jpeg', velikost: uc.size, vytvoreno: ted + 1, blob: uc, nahled: (await zpracujObrazek(new File([uc], 'u.jpg', { type: 'image/jpeg' }), 0)).nahled });
    if (await zapis(async () => { await DB.uloz('polozky', pol); await DB.uloz('prilohy', pril); })) {
      info('Vloženo ' + pol.length + ' ukázkových položek se štítkem „ukázka“.'); skrytaUpozorneni = false; await obnovVse(true); vykresliUpozorneni();
    }
  }
  $('btnUkazka').addEventListener('click', vlozUkazku);

  /* ---------- čtečka QR ---------- */
  let proud = null, smycka = 0, detektor = null;
  function nactiJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise((ok, ch) => { const s = document.createElement('script'); s.src = 'lib/jsQR.min.js'; s.onload = () => ok(window.jsQR); s.onerror = () => ch(new Error('Čtečku QR se nepodařilo načíst.')); document.head.appendChild(s); });
  }
  function nalezeno(text) {
    const id = J.idZeSkenu(text);
    if (!id) { $('cteckaStav').textContent = 'Načtený kód není štítek této evidence: ' + String(text).slice(0, 80); return false; }
    if (!S.polozky.some(p => p.id === id)) { $('cteckaStav').textContent = 'Štítek ' + id + ' – položka v této evidenci není (jiný prohlížeč nebo smazaná data?).'; return false; }
    zastavKameru(); $('dlgCtecka').close(); otevriEditor(id); return true;
  }
  async function dekodujObraz(zdroj, w, h) {
    if (detektor) { try { const r = await detektor.detect(zdroj); if (r.length) return r[0].rawValue; } catch (e) { /* přejít na jsQR */ } }
    const jsQR = await nactiJsQR();
    const c = dekodujObraz.c || (dekodujObraz.c = document.createElement('canvas'));
    const k = Math.min(1, 1000 / Math.max(w, h)); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(zdroj, 0, 0, c.width, c.height);
    const r = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
    return r ? r.data : null;
  }
  async function spustKameru() {
    const v = $('cteckaVideo');
    try { if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) detektor = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detektor = null; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('cteckaStav').textContent = 'Kamera není dostupná (vyžaduje HTTPS a podporu prohlížeče). Načtěte fotku štítku nebo opište ID.'; return; }
    try {
      proud = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      if (!$('dlgCtecka').open) { zastavKameru(); return; }
      v.srcObject = proud; v.hidden = false; await v.play();
      $('cteckaStav').textContent = 'Namiřte kameru na QR kód štítku.';
      let bezi = false;
      const krok = async () => {
        if (!proud) return;
        if (!bezi && v.readyState >= 2) {
          bezi = true;
          try { const t = await dekodujObraz(v, v.videoWidth, v.videoHeight); if (t && nalezeno(t)) return; } catch (e) { /* další snímek */ }
          bezi = false;
        }
        smycka = requestAnimationFrame(krok);
      };
      smycka = requestAnimationFrame(krok);
    } catch (e) {
      $('cteckaStav').textContent = (e && e.name === 'NotAllowedError' ? 'Přístup ke kameře byl odepřen.' : 'Kameru se nepodařilo spustit.') + ' Můžete načíst fotku štítku nebo opsat ID.';
    }
  }
  function zastavKameru() {
    cancelAnimationFrame(smycka);
    if (proud) for (const t of proud.getTracks()) t.stop();
    proud = null; $('cteckaVideo').hidden = true; $('cteckaVideo').srcObject = null;
  }
  $('btnSken').addEventListener('click', () => { $('cteckaRucne').value = ''; $('cteckaStav').textContent = 'Spouštím kameru…'; $('dlgCtecka').showModal(); spustKameru(); });
  $('dlgCtecka').addEventListener('close', zastavKameru);
  $('dlgCtecka').querySelector('[data-zavrit]').addEventListener('click', () => $('dlgCtecka').close());
  $('cteckaSoubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const b = await createImageBitmap(f, { imageOrientation: 'from-image' });
      const t = await dekodujObraz(b, b.width, b.height);
      if (!t) $('cteckaStav').textContent = 'Na obrázku se QR kód nenašel. Zkuste ostřejší fotku zblízka.'; else nalezeno(t);
    } catch (err) { $('cteckaStav').textContent = 'Obrázek nelze přečíst.'; }
  });
  const otevriRucne = () => { const t = $('cteckaRucne').value; if (t.trim()) nalezeno(t.trim()); };
  $('cteckaOtevrit').addEventListener('click', otevriRucne);
  $('cteckaRucne').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); otevriRucne(); } });

  /* ---------- odkaz #p=ID, synchronizace karet, start ---------- */
  function zHashe() {
    const m = /^#p=(.+)$/.exec(location.hash);
    if (!m) return;
    const id = J.idZeSkenu('#p=' + decodeURIComponent(m[1]));
    if (id && S.polozky.some(p => p.id === id)) { if (!ed || ed.id !== id) otevriEditor(id); }
    else { chyba('Položka ze štítku (' + decodeURIComponent(m[1]).slice(0, 20) + ') v této evidenci není.'); history.replaceState(null, '', location.pathname + location.search); }
  }
  window.addEventListener('hashchange', zHashe);
  if (bc) bc.onmessage = async () => { await nacti(); if (!ed) vykresli(); };
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
      e.preventDefault(); prepni('polozky'); $('fDotaz').focus();
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && J.dnesIso() !== dnes) { dnes = J.dnesIso(); vykresli(); vykresliUpozorneni(); } });

  async function start() {
    try {
      await nacti();
      if (!S.schema) { await prvniSpusteni(); await nacti(); }
    } catch (e) {
      console.error(e);
      $('upozorneni').innerHTML = '<div class="hlaseni chyba"><b>Úložiště není dostupné.</b> ' + esc(DB.popisChyby(e)) + ' Bez IndexedDB evidence nefunguje (např. některá anonymní okna).</div>';
      return;
    }
    nactiFiltry();
    vykresli();
    prepni(lsCti('list', 'polozky'));
    await vykresliUpozorneni();
    zHashe();
  }
  window.MajetekApp = { stav: () => S, otevriEditor, vlozUkazku, prepni, sestavZalohu, vykresli };
  start();
})();
