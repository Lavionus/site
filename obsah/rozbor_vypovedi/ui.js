/* Stránka 🗒️ Rozbor výpovědi – text dokumentu ve spisu, vyznačené nálezy, zvýraznění, přenos do spisu.
   Dokument = entita `dokument` spisu: data { druh, datum, osoba, text, sha256, rozbor { odmitnute, upravy, rucni, znacky, prenos } }.
   Jádro (rozpoznávání a zápis do spisu) je v rozbor_vypovedi/jadro.js (window.ROZBOR). */
(function () {
  'use strict';
  const S = window.SPIS, R = window.ROZBOR, el = S.el;
  const $ = id => document.getElementById(id);
  const NASTROJ = R.NASTROJ, KLIC = 'webapp_rozbor_vypovedi';   // { [případ]: id otevřeného dokumentu }
  const ne = (tag, text, atr) => el(tag, Object.assign({ 'data-i18n': 'ne', text: text == null ? '' : String(text) }, atr || {}));
  const chyba = e => Dialog.chyba(e && e.message ? e.message : String(e));
  const dnes = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  let pripad = null, dokumenty = [], dok = null, nalezy = [], udalosti = [], kontext = {}, aktN = null, upravuji = null, vyber = null, znackaUprav = null;

  const pamet = () => { try { return JSON.parse(localStorage.getItem(KLIC) || '{}') || {}; } catch (e) { return {}; } };
  const zapamatuj = id => { try { const p = pamet(); if (id) p[pripad.id] = id; else delete p[pripad.id]; localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* bez úložiště */ } };
  const stav = (t, varovani) => { $('stav').textContent = t || ''; $('stav').classList.toggle('var', !!varovani); };
  const maText = e => e && typeof e.data.text === 'string';

  /* ================= načtení ================= */
  async function nacti() {
    try {
      const id = S.aktivni();
      pripad = id ? await S.pripad(id) : null;
      $('chybaUloziste').hidden = true;
    } catch (e) {
      $('chybaUloziste').textContent = e.message; $('chybaUloziste').hidden = false;
      $('uvod').hidden = $('prace').hidden = $('formular').hidden = true;
      return;
    }
    if (!pripad) { dok = null; dokumenty = []; kontext = {}; if (upravuji && !upravuji.dok) naplnOsoby(''); zobraz(upravuji ? 'formular' : 'uvod'); return; }
    dokumenty = (await S.seznam('dokument')).filter(maText);
    kontext = { osoby: await S.seznam('osoba'), mista: await S.seznam('misto'), telefony: await S.seznam('telefon'), vozidla: await S.seznam('vozidlo'), ucty: await S.seznam('ucet') };
    udalosti = await S.seznam('udalost');
    const chci = dok ? dok.id : pamet()[pripad.id];
    dok = dokumenty.find(d => d.id === chci) || null;
    if (upravuji) { if (!upravuji.dok) naplnOsoby($('fOsoba').value); return zobraz('formular'); }
    if (!dok && dokumenty.length) dok = dokumenty[0];
    if (!dok) { otevriFormular(null); return; }
    zapamatuj(dok.id);
    vykresli();
    zobraz('prace');
  }
  function zobraz(co) {
    $('uvod').hidden = co !== 'uvod'; $('formular').hidden = co !== 'formular'; $('prace').hidden = co !== 'prace';
    document.querySelectorAll('[data-potrebuje-dok]').forEach(b => { b.disabled = !(dok && co === 'prace'); });
    skryjVyber();
  }

  /* ================= formulář dokumentu ================= */
  function otevriFormular(d) {
    upravuji = { dok: d };
    $('fTitulek').textContent = d ? '✏️ Upravit dokument' : '➕ Nový dokument';
    $('fNazev').value = d ? d.nazev : '';
    $('fDruh').value = d && [...$('fDruh').options].some(o => o.value === d.data.druh) ? d.data.druh : 'výpověď';
    $('fDatum').value = (d && d.data.datum) || dnes();
    $('fText').value = d ? d.data.text : ($('fText').value || '');
    naplnOsoby((d && d.data.osoba) || '');
    $('fZrusit').hidden = !d && !dok;
    zobraz('formular');
  }
  // výběr osoby z otevřeného spisu (po přepnutí spisu nesmí zůstat id osoby z jiného případu)
  function naplnOsoby(vybrana) {
    const s = $('fOsoba');
    s.replaceChildren(el('option', { value: '', text: '— nikdo / neuvedeno —' }), ...(kontext.osoby || []).map(o => ne('option', o.nazev, { value: o.id })));
    s.value = (kontext.osoby || []).some(o => o.id === vybrana) ? vybrana : '';
  }
  async function ulozFormular() {
    const text = $('fText').value.replace(/\r\n?/g, '\n').trim();
    if (!text) return Dialog.chyba('Vložte text výpovědi nebo záznamu.');
    try {
      if (!pripad) {
        if (!(await Dialog.potvrd('Není otevřený žádný spis. Dokument se ukládá do spisu případu – založit nový případ?', { ok: 'Založit' }))) return;
        const n = await Dialog.zeptej('Název nového případu', '');
        if (n === null || !n.trim()) return;
        const p = await S.zalozPripad({ nazev: n }, { nastroj: NASTROJ });
        await S.otevri(p.id); pripad = p;
      }
      const stary = upravuji && upravuji.dok ? await S.entita(upravuji.dok.id) : null;
      const rozbor = R.rozborDokumentu(stary);
      let ztraceno = 0;
      if (stary && stary.data.text !== text) {       // úryvky najít v novém textu
        const r1 = R.premapuj(rozbor.rucni, text), r2 = R.premapuj(rozbor.znacky, text);
        rozbor.rucni = r1.ok; rozbor.znacky = r2.ok; ztraceno = r1.ztracene.length + r2.ztracene.length;
        for (const z of r2.ztracene) if (z.vazba) { try { await S.smaz(z.vazba, { nastroj: NASTROJ }); } catch (e) { /* už není */ } }
      }
      const nazev = $('fNazev').value.trim() || text.split('\n')[0].slice(0, 80);
      const data = Object.assign({}, stary ? stary.data : {}, { druh: $('fDruh').value, datum: $('fDatum').value || undefined, osoba: $('fOsoba').value || undefined,
        text, sha256: await S.sha256(text), rozbor });
      const e = await S.uloz({ id: stary ? stary.id : undefined, typ: 'dokument', nazev, data }, { nastroj: NASTROJ });
      upravuji = null; dok = e; $('fText').value = '';
      await nacti();
      stav(stary ? 'Dokument uložen.' + (ztraceno ? ' ' + ztraceno + ' označených úryvků se v novém textu nenašlo – byly odebrány.' : '') : 'Dokument uložen do spisu a rozebrán.', ztraceno > 0);
    } catch (e) { chyba(e); }
  }
  $('fUlozit').addEventListener('click', ulozFormular);
  $('fZrusit').addEventListener('click', () => { upravuji = null; nacti(); });

  async function nactiSoubor(f) {
    const buf = await f.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('�')) { try { t = new TextDecoder('windows-1250').decode(buf); } catch (e) { /* zůstane UTF-8 */ } }
    vlozText(t.replace(/^﻿/, ''), f.name.replace(/\.[^.]+$/, ''));
  }
  function vlozText(t, nazev) {
    if (!upravuji) otevriFormular(null);
    $('fText').value = t;
    if (nazev && !$('fNazev').value) $('fNazev').value = nazev;
    $('fText').focus();
  }
  $('vstupSoubor').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) nactiSoubor(f).catch(chyba); });

  /* ================= vykreslení textu a panelu ================= */
  function vykresli() {
    nalezy = R.nalezyDokumentu(dok, kontext);
    const d = dok.data, osoba = (kontext.osoby || []).find(o => o.id === d.osoba);
    $('dNazev').textContent = dok.nazev;
    $('dMeta').replaceChildren(ne('span', [d.druh, d.datum ? R.formatDen(d.datum) : 'bez data záznamu', osoba ? osoba.nazev : null].filter(Boolean).join(' · ')));
    vykresliText(); vykresliNalezy(); vykresliZnacky();
  }
  const rozbor = () => R.rozborDokumentu(dok);
  function vykresliText() {
    const text = dok.data.text, Z = rozbor().znacky, body = new Set([0, text.length]);
    for (const x of [...nalezy, ...Z]) { body.add(x.od); body.add(x.do); }
    const hr = [...body].filter(i => i >= 0 && i <= text.length).sort((a, b) => a - b);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < hr.length - 1; i++) {
      const a = hr[i], b = hr[i + 1];
      if (a === b) continue;
      const n = nalezy.filter(x => x.od <= a && x.do >= b).pop();
      const z = Z.filter(x => x.od <= a && x.do >= b).pop();
      const sp = el('span', { 'data-o': a, text: text.slice(a, b) });
      if (n) {
        sp.dataset.n = n.klic;
        sp.className = 't-' + n.typ + (n.nejiste ? ' nejiste' : '') + (n.odmitnuto ? ' odm' : '') + (aktN === n.klic ? ' akt' : '');
        sp.title = R.TYPY[n.typ].nazev + ': ' + R.popisHodnoty(n) + ' (' + n.presnost + ')';
      }
      if (z) { sp.classList.add('z-' + z.stav); sp.dataset.z = z.id; }
      frag.append(sp);
    }
    $('text').replaceChildren(frag);
  }
  function vykresliNalezy() {
    const kont = $('nalezy');
    kont.replaceChildren();
    const aktivni = nalezy.filter(n => !n.odmitnuto).length;
    $('pocetN').textContent = '(' + aktivni + (aktivni !== nalezy.length ? ' + ' + (nalezy.length - aktivni) + ' odmítnuto' : '') + ')';
    for (const typ of Object.keys(R.TYPY)) {
      const v = nalezy.filter(n => n.typ === typ);
      if (!v.length) continue;
      const T = R.TYPY[typ];
      kont.append(el('h3', null, T.ikona + ' ' + T.nazev, el('span', { class: 'pocet', text: '(' + v.length + ')' })));
      const ul = el('ul', { class: 'seznam' });
      for (const n of v) ul.append(polozka(n));
      kont.append(ul);
    }
    if (!nalezy.length) kont.append(el('p', { class: 'pozn', text: 'Automatika v textu nic nenašla. Úryvek můžete označit ručně.' }));
  }
  function polozka(n) {
    const T = R.TYPY[n.typ];
    const li = el('li', { 'data-klic': n.klic, class: (n.odmitnuto ? 'odm' : '') + (aktN === n.klic ? ' akt' : '') });
    li.append(el('div', { class: 'r1' }, ne('span', '„' + n.text.replace(/\s+/g, ' ') + '“', { class: 'uryvek', 'data-ukaz': n.klic, title: 'Ukázat v textu' }),
      n.nejiste && !n.odmitnuto ? el('span', { class: 'znak tvrzeni', text: 'nejisté', title: 'Ověřte – automatika si není jistá' }) : null,
      n.rucni ? el('span', { class: 'znak', text: 'ručně' }) : null));
    li.append(ne('div', '→ ' + R.popisHodnoty(n), { class: 'hod' }));
    li.append(el('div', { class: 'pres', text: n.presnost + (n.upraveno ? ' · upraveno' : '') }));
    const akce = el('div', { class: 'akce' });
    if (!n.odmitnuto) {
      if (n.preneseno) {
        const e = n.typ === 'cas' ? udalosti.find(u => u.id === n.preneseno) : null;
        akce.append(el('button', { type: 'button', class: 'tl mini', 'data-akce': 'karta', 'data-klic': n.klic, title: 'Otevřít kartu ve spisu' }, '✓ Ve spisu'));
        if (e) for (const s of R.strety(e, udalosti)) li.append(el('div', { class: 'stret' }, '⚠ Střet: ', ne('span', s.nazev + ' (' + R.formatCas(s.data.kdy) + (s.data.do ? ' – ' + R.formatCas(s.data.do) : '') + ')')));
      } else if (T.prenos) {
        akce.append(el('button', { type: 'button', class: 'tl mini hlavni', 'data-akce': 'prenes', 'data-klic': n.klic,
          title: n.typ === 'cas' ? 'Přenést na časovou osu spisu (událost)' : 'Přenést do spisu a propojit s dokumentem' }, n.typ === 'cas' ? '➜ Na časovou osu' : '➜ Do spisu'));
      } else if (n.entita) akce.append(el('span', { class: 've-spisu', text: '✓ ve spisu' }));
      akce.append(el('button', { type: 'button', class: 'tl mini', 'data-akce': 'uprav', 'data-klic': n.klic, title: 'Upravit hodnotu' }, '✏️'));
    }
    akce.append(n.rucni ? el('button', { type: 'button', class: 'tl mini nebezpecne', 'data-akce': 'smazRucni', 'data-klic': n.klic, title: 'Smazat ruční nález' }, '🗑️')
      : n.odmitnuto ? el('button', { type: 'button', class: 'tl mini', 'data-akce': 'obnov', 'data-klic': n.klic, title: 'Vrátit nález' }, '↺ Vrátit')
        : el('button', { type: 'button', class: 'tl mini', 'data-akce': 'odmitni', 'data-klic': n.klic, title: 'Odmítnout – falešný nález' }, '✕ Odmítnout'));
    li.append(akce);
    return li;
  }
  function vykresliZnacky() {
    const Z = rozbor().znacky, ul = $('znacky');
    $('pocetZ').textContent = Z.length ? '(' + Z.length + ')' : '';
    $('znackyPrazdne').hidden = Z.length > 0;
    ul.replaceChildren(...Z.map(z => {
      const d = z.dukaz ? S.el('span') : null;
      if (d) S.entita(z.dukaz).then(e => { d.replaceChildren(el('span', { text: 'důkaz: ' }), ne('button', e ? e.nazev : z.dukaz, { type: 'button', class: 'odkaz', 'data-akce': 'kartaDukazu', 'data-id': z.dukaz })); });
      return el('li', { 'data-z': z.id },
        el('div', { class: 'r1' }, el('span', { class: 'znak ' + z.stav, text: R.ZNACKY[z.stav] }), ne('span', '„' + z.text.replace(/\s+/g, ' ') + '“', { class: 'uryvek', 'data-ukazz': z.id })),
        z.poznamka ? ne('div', z.poznamka, { class: 'pres' }) : null, d ? el('div', { class: 'pres' }, d) : null,
        el('div', { class: 'akce' }, el('button', { type: 'button', class: 'tl mini', 'data-akce': 'upravZ', 'data-id': z.id }, '✏️ Upravit')));
    }));
  }
  function ukaz(klic, posunText) {
    aktN = klic;
    document.querySelectorAll('#text span.akt, #nalezy li.akt').forEach(x => x.classList.remove('akt'));
    const spany = [...document.querySelectorAll('#text span[data-n]')].filter(s => s.dataset.n === klic);
    spany.forEach(s => s.classList.add('akt'));
    const li = [...document.querySelectorAll('#nalezy li[data-klic]')].find(x => x.dataset.klic === klic);
    if (li) { li.classList.add('akt'); if (!posunText) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    if (posunText && spany[0]) spany[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ================= akce nad nálezy ================= */
  const najdiN = klic => nalezy.find(n => n.klic === klic);
  async function ulozR(fn, zprava) {
    try { dok = await R.ulozRozbor(S, dok, fn); vykresli(); if (zprava) stav(zprava); } catch (e) { chyba(e); }
  }
  async function prenes(n) {
    try {
      const r = await R.prenes(S, dok, n, { nalezy });
      dok = r.dok;
      udalosti = await S.seznam('udalost');
      kontext = { osoby: await S.seznam('osoba'), mista: await S.seznam('misto'), telefony: await S.seznam('telefon'), vozidla: await S.seznam('vozidlo'), ucty: await S.seznam('ucet') };
      vykresli(); ukaz(n.klic);
      const co = n.typ === 'cas' ? 'Událost' : S.TYPY[r.entita.typ].nazev;
      stav((r.nova ? co + ' uložena do spisu: ' : co + ' už ve spisu byla – jen propojeno: ') + r.entita.nazev
        + (r.strety.length ? ' ⚠ Střet s ' + r.strety.length + ' událostí téže osoby na jiném místě: ' + r.strety.map(s => s.nazev).join('; ') : ''), r.strety.length > 0);
    } catch (e) { chyba(e); }
  }
  async function uprav(n) {
    const napoveda = { cas: 'Čas jako 2026-11-14T22:45 nebo 14. 11. 2026 22:45, interval odděleně „/“', datum: 'Datum jako 2026-11-14 nebo 14. 11. 2026', telefon: 'Telefonní číslo (9 číslic, případně +420)' }[n.typ] || 'Hodnota (např. jméno v 1. pádě)';
    const t = await Dialog.zeptej(napoveda, n.hodnota || '');
    if (t === null) return;
    const h = R.platnaHodnota(n.typ, t);
    if (!h) return Dialog.chyba('Neplatná hodnota. ' + napoveda + '.');
    if (n.rucni) return ulozR(Rz => { const x = Rz.rucni.find(r => r.klic === n.klic); if (x) { x.hodnota = h; delete x.entita; } }, 'Nález upraven.');
    // jiná hodnota osoby/místa = jiná entita → při přenosu se hledá podle hodnoty
    ulozR(Rz => { Rz.upravy[n.klic] = Object.assign({ hodnota: h }, ['osoba', 'misto', 'telefon', 'spz', 'ucet'].includes(n.typ) && h !== n.hodnota ? { entita: '' } : {}); }, 'Nález upraven.');
  }
  async function akce(b) {
    const n = najdiN(b.dataset.klic);
    switch (b.dataset.akce) {
      case 'prenes': return n && prenes(n);
      case 'uprav': return n && uprav(n);
      case 'odmitni': return n && ulozR(Rz => { if (!Rz.odmitnute.includes(n.klic)) Rz.odmitnute.push(n.klic); }, 'Nález odmítnut.');
      case 'obnov': return n && ulozR(Rz => { Rz.odmitnute = Rz.odmitnute.filter(k => k !== n.klic); }, 'Nález vrácen.');
      case 'smazRucni': return n && ulozR(Rz => { Rz.rucni = Rz.rucni.filter(r => r.klic !== n.klic); delete Rz.upravy[n.klic]; }, 'Ruční nález smazán.');
      case 'karta': return n && SpisKarta.otevri(n.preneseno, { nastroj: NASTROJ });
      case 'kartaDukazu': return SpisKarta.otevri(b.dataset.id, { nastroj: NASTROJ });
      case 'upravZ': return otevriZnacku(rozbor().znacky.find(z => z.id === b.dataset.id));
    }
  }

  /* ================= ruční označení výběrem ================= */
  // pozice v textu z místa v DOM (textový uzel uvnitř <span data-o>)
  function pozice(uzel, off) {
    const T = $('text');
    if (!T.contains(uzel)) return null;
    if (uzel === T) { const c = T.childNodes[off]; return c ? +c.dataset.o : dok.data.text.length; }
    const sp = uzel.nodeType === 3 ? uzel.parentElement : uzel;
    if (!sp || sp.dataset.o === undefined) return null;
    return +sp.dataset.o + (uzel.nodeType === 3 ? off : (off ? sp.textContent.length : 0));
  }
  function ctiVyber() {
    const s = window.getSelection();
    if (!dok || !s || s.isCollapsed || !s.rangeCount) return null;
    const r = s.getRangeAt(0);
    let a = pozice(r.startContainer, r.startOffset), b = pozice(r.endContainer, r.endOffset);
    if (a === null || b === null) return null;
    const t = dok.data.text;
    while (a < b && /\s/.test(t[a])) a++;
    while (b > a && /\s/.test(t[b - 1])) b--;
    return b > a ? { od: a, do: b, text: t.slice(a, b) } : null;
  }
  let lista = null;
  function skryjVyber() { if (lista) { lista.remove(); lista = null; } }
  function ukazVyber() {
    skryjVyber();
    vyber = ctiVyber();
    if (!vyber) return;
    const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
    lista = el('div', { class: 'vyber-lista', role: 'toolbar', 'aria-label': 'Označit úryvek' },
      ...Object.entries(R.TYPY).map(([k, T]) => el('button', { type: 'button', class: 'tl', 'data-prikaz': 'oznac', 'data-typ': k, title: 'Označit jako: ' + T.nazev }, T.ikona + ' ' + T.nazev)),
      el('span', { class: 'odd' }),
      el('button', { type: 'button', class: 'tl', 'data-prikaz': 'zvyrazni', 'data-stav': 'overeno' }, '✅ ověřené'),
      el('button', { type: 'button', class: 'tl', 'data-prikaz': 'zvyrazni', 'data-stav': 'tvrzeni' }, '💬 tvrzení'),
      el('button', { type: 'button', class: 'tl', 'data-prikaz': 'zvyrazni', 'data-stav': 'rozpor' }, '⚠️ rozpor'));
    lista.addEventListener('mousedown', e => e.preventDefault());   // výběr textu nezmizí
    document.body.append(lista);
    const top = r.top - lista.offsetHeight - 8;
    lista.style.top = Math.max(6, top < 50 ? r.bottom + 8 : top) + 'px';
    lista.style.left = Math.max(6, Math.min(r.left, innerWidth - lista.offsetWidth - 6)) + 'px';
  }
  $('text').addEventListener('mouseup', () => setTimeout(ukazVyber, 0));
  $('text').addEventListener('keyup', e => { if (e.shiftKey) ukazVyber(); });
  document.addEventListener('selectionchange', () => { const v = ctiVyber(); if (v) vyber = v; else if (lista && !lista.matches(':hover')) skryjVyber(); });

  function oznac(typ) {
    const v = ctiVyber() || vyber;
    if (!v) return Dialog.info('Nejdřív v textu označte úryvek myší nebo prstem.');
    const n = R.rucniNalez(dok.data.text, v.od, v.do, typ, Object.assign({}, kontext, { datum: dok.data.datum }));
    window.getSelection().removeAllRanges(); skryjVyber(); vyber = null;
    ulozR(Rz => { Rz.rucni = Rz.rucni.filter(r => r.klic !== n.klic).concat(n); }, 'Ručně označeno: ' + R.TYPY[typ].nazev + ' „' + v.text + '“.').then(() => ukaz(n.klic));
  }

  /* ================= zvýraznění s důkazem ================= */
  async function otevriZnacku(z) {
    znackaUprav = z;
    $('zUryvek').textContent = '„' + z.text + '“';
    document.querySelectorAll('input[name=zStav]').forEach(r => { r.checked = r.value === z.stav; });
    const ent = (await S.seznam()).filter(e => e.id !== dok.id && ['stopa', 'foto', 'udalost', 'dokument', 'telefon', 'vozidlo', 'ucet', 'osoba', 'misto'].includes(e.typ));
    $('zDukaz').replaceChildren(el('option', { value: '', text: '— bez důkazu —' }), ...ent.map(e => ne('option', S.TYPY[e.typ].ikona + ' ' + e.nazev, { value: e.id })));
    $('zDukaz').value = z.dukaz || '';
    $('zPozn').value = z.poznamka || '';
    $('zSmazat').hidden = !z.id;
    $('dlgZnacka').showModal();
  }
  function zvyrazni(stavZ) {
    const v = ctiVyber() || vyber;
    if (!v) return Dialog.info('Nejdřív v textu označte úryvek myší nebo prstem.');
    window.getSelection().removeAllRanges(); skryjVyber(); vyber = null;
    otevriZnacku({ od: v.od, do: v.do, text: v.text, stav: stavZ });
  }
  $('zUlozit').addEventListener('click', async () => {
    const z = Object.assign({}, znackaUprav, { stav: (document.querySelector('input[name=zStav]:checked') || {}).value || znackaUprav.stav, dukaz: $('zDukaz').value || undefined, poznamka: $('zPozn').value.trim() || undefined });
    try {
      const r = await R.ulozZnacku(S, dok, z);
      dok = r.dok; $('dlgZnacka').close(); vykresli();
      stav('Zvýrazněno jako „' + R.ZNACKY[z.stav] + '“' + (z.dukaz ? ' – důkaz propojen ve spisu (' + (z.stav === 'overeno' ? 'potvrzuje' : z.stav === 'rozpor' ? 'vyvrací' : 'souvisí') + ').' : '.'));
    } catch (e) { chyba(e); }
  });
  $('zSmazat').addEventListener('click', async () => {
    try { dok = await R.smazZnacku(S, dok, znackaUprav.id); $('dlgZnacka').close(); vykresli(); stav('Zvýraznění smazáno.'); } catch (e) { chyba(e); }
  });

  /* ================= příkazy lišty ================= */
  async function ukazka() {
    try {
      const r = await R.zalozModel(S, window.MODELOVY_PRIPAD);
      upravuji = null; dok = { id: r.dokumenty[0] };
      await nacti();
      stav(r.pridano ? 'Modelový případ 17/2026: do spisu přidány ' + r.pridano + ' dokumenty (výpověď L. Fialy, úřední záznam M. Dvořákové).' : 'Dokumenty modelového případu už ve spisu jsou – otevřeny beze změn.');
    } catch (e) { chyba(e); }
  }
  const PRIKAZY = {
    novy() { otevriFormular(null); $('fText').value = ''; $('fNazev').value = ''; },
    nacist() { $('vstupSoubor').click(); },
    async schranka() {
      try { const t = await navigator.clipboard.readText(); if (!t.trim()) return Dialog.info('Schránka je prázdná.'); vlozText(t); }
      catch (e) { if (!upravuji) otevriFormular(null); $('fText').focus(); Dialog.info('Prohlížeč nedovolil číst schránku. Vložte text do pole klávesami Ctrl+V (na telefonu dlouhým stiskem → Vložit).'); }
    },
    upravit() { if (dok) otevriFormular(dok); },
    karta() { if (dok) SpisKarta.otevri(dok.id, { nastroj: NASTROJ }); },
    ukazka,
    async smazat() {
      if (!dok || !(await Dialog.potvrd('Smazat dokument „' + dok.nazev + '“ ze spisu? Zůstane v historii spisu a jde obnovit na stránce Spis případu. Události a entity přenesené z něj zůstanou.', { ok: 'Smazat' }))) return;
      try { await S.smaz(dok.id, { nastroj: NASTROJ }); dok = null; zapamatuj(null); await nacti(); } catch (e) { chyba(e); }
    },
    async novyPripad() {
      const n = await Dialog.zeptej('Název nového případu', '');
      if (n === null || !n.trim()) return;
      try { const p = await S.zalozPripad({ nazev: n }, { nastroj: NASTROJ }); await S.otevri(p.id); } catch (e) { chyba(e); }
    },
    otevrit(b) { upravuji = null; dok = { id: b.dataset.id }; nacti(); },
    oznac(b) { oznac(b.dataset.typ); },
    zvyrazni(b) { zvyrazni(b.dataset.stav); },
    napoveda() { $('dlgNapoveda').showModal(); }
  };

  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function seznamDokumentu() {
    const s = $('nabDokSeznam');
    s.replaceChildren(...(dokumenty.length ? dokumenty.map(d => el('button', { type: 'button', class: 'tl', role: 'menuitemradio', 'aria-checked': String(!!dok && d.id === dok.id), 'data-prikaz': 'otevrit', 'data-id': d.id },
      '📄 ', ne('span', d.nazev))) : [el('div', { class: 'pozn', text: pripad ? 'Ve spisu zatím není žádný dokument s textem.' : 'Není otevřený spis.' })]));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('mousedown', e => { if (vyber) e.preventDefault(); }));
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo || b.disabled) return;
    if (n.id === 'nabDok') seznamDokumentu();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](b); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    const a = e.target.closest('[data-akce]');
    if (a) return akce(a);
    const u = e.target.closest('[data-ukaz]');
    if (u) return ukaz(u.dataset.ukaz, true);
    const uz = e.target.closest('[data-ukazz]');
    if (uz) { const s = document.querySelector('#text span[data-z="' + CSS.escape(uz.dataset.ukazz) + '"]'); if (s) s.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const sp = e.target.closest('#text span[data-n], #text span[data-z]');
    if (sp && window.getSelection().isCollapsed) {
      if (sp.dataset.n) ukaz(sp.dataset.n);
      else { const z = rozbor().znacky.find(x => x.id === sp.dataset.z); if (z) otevriZnacku(z); }
    }
  });
  document.querySelectorAll('[data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { zavriNabidky(); skryjVyber(); } });
  addEventListener('resize', () => { zavriNabidky(); skryjVyber(); });
  // vložení textu klávesami mimo pole → nový dokument
  document.addEventListener('paste', e => {
    if (e.target.closest && e.target.closest('input, textarea, dialog') || !$('prace').hidden) return;
    const t = e.clipboardData && e.clipboardData.getData('text/plain');
    if (t && t.trim()) { e.preventDefault(); vlozText(t); }
  });

  // synchronizace se spisem (jiné záložky, výběr případu, karta)
  let ceka = null;
  S.odebirej(u => {
    // jiný spis: úprava dokumentu starého spisu končí, rozepsaný nový dokument zůstane (uloží se do nově zvoleného)
    if (u.druh === 'aktivni') { dok = null; if (upravuji && upravuji.dok) upravuji = null; }
    if (u.druh === 'aktivni' || u.druh === 'pripad' || u.druh === 'import' || (!u.mistni && pripad && u.pripad === pripad.id)) { clearTimeout(ceka); ceka = setTimeout(nacti, 60); }
  });
  addEventListener('storage', e => { if (e.key === S.KLIC_AKTIVNI) { dok = null; nacti(); } });

  SpisVyber.vloz($('vyberMisto'), { nastroj: NASTROJ });
  // průvodce modelovým případem (?pripad=17): rovnou výpověď L. Fialy z modelového spisu
  if (window.ModelovyPripad && window.ModelovyPripad.aktivni) ukazka(); else nacti();
  window.ROZBOR_APP = { PRIKAZY, nacti, stav: () => ({ pripad: pripad && pripad.id, dok: dok && dok.id, nalezy, formular: !$('formular').hidden }), prenes: klic => prenes(najdiN(klic)) };
})();
