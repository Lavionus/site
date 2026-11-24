/* ============================================================
   Dílna výprav – ui.js
   Rozhraní průvodce: příběh, stanoviště se šiframi, mapa pokladu,
   kontrola řetězu, tisk (karty, nápovědy, pomůcky, tahák) a rady.
   Data v localStorage `webapp_vyprava` (výpravy jsou malé – text
   a souřadnice značek).
   ============================================================ */
(function () {
  'use strict';
  const V = window.VYPRAVA, MP = window.VYPRAVA_MAPA;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KLIC = 'webapp_vyprava';

  /* ---------- úložiště ---------- */
  let data = { aktivni: null, vypravy: {}, krok: 'pribeh', tisk: {} };
  try { Object.assign(data, JSON.parse(localStorage.getItem(KLIC)) || {}); } catch (e) { /* nové */ }
  for (const id in data.vypravy) data.vypravy[id] = V.normalizuj(data.vypravy[id]);
  let v = data.vypravy[data.aktivni];
  if (!v) { v = V.ukazka(); data.vypravy[v.id] = v; data.aktivni = v.id; }
  let vybraneSt = 0, vybranaZnacka = null, casUlozeni = 0;
  function uloz() {
    v.zmeneno = Date.now();
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => {
      zapisHistorii();
      try { localStorage.setItem(KLIC, JSON.stringify(data)); } catch (e) { zprava('Uložení se nepovedlo – prohlížeč nemá místo.'); }
    }, 350);
  }

  /* ---------- Zpět / Znovu ----------
     Snímek výpravy (bez času změny) po každé dávce úprav; psaní se slučuje
     díky zpoždění uložení. */
  let historie = [], vpred = [];
  const snimek = () => JSON.stringify(Object.assign({}, v, { zmeneno: 0 }));
  function zapisHistorii() {
    const s = snimek();
    if (historie[historie.length - 1] === s) return;
    historie.push(s); if (historie.length > 80) historie.shift();
    vpred = []; tlacitkaHistorie();
  }
  function obnovSnimek(s) {
    const n = V.normalizuj(JSON.parse(s)); n.id = v.id;
    data.vypravy[v.id] = v = n;
    try { localStorage.setItem(KLIC, JSON.stringify(data)); } catch (e) { /* nevadí */ }
    vybraneSt = Math.min(vybraneSt, Math.max(0, v.stanoviste.length - 1));
    if (!v.mapa.znacky.some(z => z.id === vybranaZnacka)) vybranaZnacka = null;
    aplikujVzhled(); vse(); tlacitkaHistorie();
  }
  function zpet() { if (historie.length < 2) return; vpred.push(historie.pop()); obnovSnimek(historie[historie.length - 1]); }
  function znovu() { if (!vpred.length) return; const s = vpred.pop(); historie.push(s); obnovSnimek(s); }
  function tlacitkaHistorie() { $('tlZpet').disabled = historie.length < 2; $('tlZnovu').disabled = !vpred.length; }
  function novaHistorie() { historie = [snimek()]; vpred = []; tlacitkaHistorie(); }

  /* ---------- písma z knihovny webu (fonty.js, i vlastní nahrané) ---------- */
  const ZALOHA_PISMA = "'IM Fell English', 'Palatino Linotype', Georgia, serif";
  const rodiny = {};   // id → načtená CSS rodina ('' = načítá se / nejde)
  function pismo(id) {
    if (!id || typeof FONTY === 'undefined') return ZALOHA_PISMA;
    if (rodiny[id]) return `"${rodiny[id]}", ${ZALOHA_PISMA}`;
    if (!(id in rodiny)) {
      rodiny[id] = '';
      FONTY.rodina(id).then(r => { rodiny[id] = r; aplikujVzhled(); obnovNahledy(); })
        .catch(() => zprava('Písmo se nepodařilo načíst – použije se náhradní.'));
    }
    return ZALOHA_PISMA;
  }
  const barvaInkoustu = () => (V.INKOUSTY[v.vzhled.inkoust] || V.INKOUSTY.hneda)[1];
  function aplikujVzhled() {
    const z = v.vzhled, k = document.documentElement.style, P = V.PECETI[z.barvaPecete] || V.PECETI.cervena;
    k.setProperty('--pismo-karet', pismo(z.pismo));
    k.setProperty('--ink', barvaInkoustu());
    if (P[1]) { k.setProperty('--pecet-a', P[1]); k.setProperty('--pecet-b', P[2]); }
    document.body.classList.toggle('papir-stary', z.papir === 'stary');
    document.body.classList.toggle('papir-cisty', z.papir === 'cisty');
    document.body.classList.toggle('bez-pecete', z.barvaPecete === 'zadna');
  }
  const pecet = () => `<div class="pecet" data-i18n="ne">${esc(v.vzhled.pecet || '✦')}</div>`;
  const volbyMapy = () => ({ ink: barvaInkoustu(), papir: v.vzhled.papir, pismo: pismo(v.vzhled.pismoMapy) });

  /* Výběr písma – sdílená komponenta FONTY.vyberFontu; po nahrání fontu se obnoví všechny. */
  let fontySlib = null, vybery = [];
  const seznamFontu = () => fontySlib || (fontySlib = typeof FONTY === 'undefined' ? Promise.resolve([]) : FONTY.seznam());
  function vyberPisma(el, hodnota, onZmena, cil, ukazka) {
    if (!el || typeof FONTY === 'undefined') return;
    const vyb = FONTY.vyberFontu(el, {
      ukazka, doporucene: cil, filtr: f => f.vlastni || f.pismo === cil(),
      onZmena, onNahrat: () => $('souborFontu').click(),
      onSmazat: async f => {
        if (!(await Dialog.potvrd(`Smazat font „${f.nazev}“? Zmizí ze všech stránek webu.`, { ok: 'Smazat' }))) return;
        await FONTY.smaz(f.id); obnovVybery();
      }
    });
    vybery = vybery.filter(x => x.el.isConnected).concat([{ el, vyb, hodnota }]);
    seznamFontu().then(sez => vyb.nastav(sez, hodnota()));
  }
  function obnovVybery() { fontySlib = null; seznamFontu().then(sez => vybery.filter(x => x.el.isConnected).forEach(x => x.vyb.nastav(sez, x.hodnota()))); }
  $('souborFontu').addEventListener('change', async e => {
    let n = 0;
    for (const f of e.target.files) { try { await FONTY.pridej(f); n++; } catch (chyba) { Dialog.chyba(chyba.message); } }
    e.target.value = '';
    if (n) { obnovVybery(); zprava(n === 1 ? 'Font přidán do knihovny webu.' : `Přidáno fontů: ${n}.`); }
  });

  /* Kontrola písma: chybí vybranému fontu znaky, které se budou tisknout? (opentype.js se načte až teď) */
  let otSlib = null, kontrolaPismaKlic = '', kontrolaPismaVysledek = [];
  function nactiOT() {
    if (window.opentype) return Promise.resolve();
    return otSlib || (otSlib = new Promise((ok, chyba) => { const sc = document.createElement('script'); sc.src = 'lib/opentype.min.js'; sc.onload = ok; sc.onerror = chyba; document.head.appendChild(sc); }));
  }
  function textyPisem() {
    const karty = [v.nazev, V.text(v.uvod, v), V.text(v.zaver, v), 'Stopa Nápověda obálka Poklad 0123456789 /']
      .concat(v.stanoviste.flatMap(s => [s.uvodKarty, ...(['ptaci', 'zednarska', 'pismo'].includes(s.typ) ? [] : [V.sifruj(s.typ, s.text, s.par).zapis]), s.par.otazka]));
    const mapa = [v.mapa.nazev, v.mapa.meritko, 'ABCDEFGH12345678S'].concat(v.mapa.znacky.map(z => z.popis));
    const out = new Map(), pridej = (id, t) => { if (!id) return; out.set(id, (out.get(id) || '') + t.filter(Boolean).join(' ')); };
    pridej(v.vzhled.pismo, karty); pridej(v.vzhled.pismoMapy, mapa);
    for (const s of v.stanoviste) if (s.typ === 'pismo') pridej(s.par.font || PREPIS_FONT[s.par.prepis], [V.sifruj('pismo', s.text, s.par).zapis]);
    return out;
  }
  async function kontrolaPisma() {
    if (typeof FONTY === 'undefined') return [];
    const texty = textyPisem(), klic = JSON.stringify([...texty]);
    if (klic === kontrolaPismaKlic) return kontrolaPismaVysledek;
    const out = [];
    try {
      await nactiOT();
      const sez = await seznamFontu();
      for (const [id, text] of texty) {
        const f = await FONTY.opentype(id).catch(() => null);
        const jmeno = (sez.find(x => x.id === id) || {}).nazev || id;
        if (!f) { out.push({ uroven: 'tip', text: `Písmo „${jmeno}“ nejde zkontrolovat (WOFF2 nebo poškozený soubor).` }); continue; }
        const chybi = [...new Set([...text])].filter(c => /\S/.test(c) && f.charToGlyphIndex(c) === 0);
        if (chybi.length) out.push({ uroven: 'varovani', text: `Písmo „${jmeno}“ nemá znaky ${chybi.slice(0, 24).join(' ')}${chybi.length > 24 ? ' …' : ''} – vytisknou se náhradním písmem.` });
      }
    } catch (e) { out.push({ uroven: 'tip', text: 'Kontrolu písma se nepodařilo spustit.' }); }
    kontrolaPismaKlic = klic; kontrolaPismaVysledek = out;
    return out;
  }
  let casZpravy = 0;
  function zprava(t) { const z = $('zprava'); z.textContent = t; z.hidden = false; clearTimeout(casZpravy); casZpravy = setTimeout(() => { z.hidden = true; }, 2600); }
  function stahni(obsah, nazev, typ) {
    const a = document.createElement('a');
    a.href = obsah instanceof Blob ? URL.createObjectURL(obsah) : URL.createObjectURL(new Blob([obsah], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  const souborNazev = () => (V.bezDiakritiky(v.nazev || 'vyprava').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vyprava');

  /* ---------- kresby šifer na kartách ---------- */
  function zednarskaSvg(z) {
    const c = 'currentColor'; let d = '', t = '';
    if (z.mrizka === '#') {
      const r = Math.floor((z.pole - 1) / 3), k = (z.pole - 1) % 3;
      if (r > 0) d += 'M4 4H30'; if (r < 2) d += 'M4 30H30'; if (k > 0) d += 'M4 4V30'; if (k < 2) d += 'M30 4V30';
      if (z.tecka) t = `<circle cx="17" cy="17" r="3" fill="${c}"/>`;
    } else {
      d = ['M4 4L17 17L30 4', 'M30 4L17 17L30 30', 'M4 30L17 17L30 30', 'M4 4L17 17L4 30'][z.pole - 1];
      if (z.tecka) t = `<circle cx="${[17, 25, 17, 9][z.pole - 1]}" cy="${[9, 17, 25, 17][z.pole - 1]}" r="3" fill="${c}"/>`;
    }
    return `<svg viewBox="0 0 34 34"><path d="${d}" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${t}</svg>`;
  }
  const zednarska = text => V.slova(text).map(w => [...w].filter(c => /[A-Z]/.test(c)).map(c => zednarskaSvg(V.zednarskaZnak(c))).join('')).join('<span class="mez"></span>');

  /* Přepisy do jiných písem (fonty/prepis.js) a jejich doporučené fonty. */
  const PREPISY = typeof PREPIS !== 'undefined' ? PREPIS.SEZNAM.filter(p => p.id !== 'morse') : [];
  const PREPIS_FONT = Object.fromEntries(PREPISY.map(p => [p.id, p.font || '']));

  /* Obsah karty stanoviště (pergamen). */
  function kartaHtml(s, i) {
    const n = v.stanoviste.length, T = V.TYPY[s.typ] || V.TYPY.hadanka;
    const r = V.sifruj(s.typ, s.text, s.par);
    let telo = '';
    switch (s.typ) {
      case 'zrcadlo': telo = `<div data-i18n="ne" class="sifra${s.par.pozpatku ? '' : ' zrcadlo'}">${esc(r.zapis)}</div>`; break;
      case 'ptaci': telo = `<div data-i18n="ne" class="sifra ptaci">${esc(r.zapis)}</div>`; break;
      case 'zednarska': telo = `<div class="zed" data-i18n="ne">${zednarska(s.text)}</div>`; break;
      case 'mrizka': telo = `<div data-i18n="ne" class="sifra">Hledej na mapě<br><b style="font-size:2.6rem">${esc(r.zapis || '?')}</b></div>`; break;
      case 'hadanka': telo = `<div data-i18n="ne" class="sifra" style="font-size:1.4rem">${esc(s.par.otazka || '')}</div>`; break;
      case 'zamek': telo = `<div data-i18n="ne" class="sifra" style="font-size:1.4rem">🔐 ${esc(s.par.otazka || '')}</div>`; break;
      case 'neviditelny': telo = `<div data-i18n="ne" class="sifra" style="min-height:4.5em"></div><p class="navod">Tahle stránka není prázdná. Požádej dospělého, ať ji podrží nad teplem.</p>`; break;
      case 'pismo': telo = `<div data-i18n="ne" class="sifra pismo" style="font-family:${esc(pismo(s.par.font || (PREPIS_FONT[s.par.prepis] || '')))}">${esc(r.zapis)}</div>`; break;
      case 'kniha': telo = `<div data-i18n="ne" class="sifra mono">${esc(r.zapis)}</div><p class="navod">řádek – slovo</p>`; break;
      default: telo = `<div data-i18n="ne" class="sifra mono">${esc(r.zapis)}</div>`;
    }
    if (s.typ === 'caesar' && s.par.ukazPosun) telo += `<p class="navod" style="text-align:center">Klíč: ${esc(s.par.posun)}</p>`;
    const napoveda = (s.napovedy || []).some(x => String(x).trim()) ? `Nápověda: obálka ${i + 1}` : '';
    const uvod = String(s.uvodKarty || '').trim() ? `<p class="uvod-karty" data-i18n="ne">${esc(s.uvodKarty)}</p>` : '';
    return `<div class="hlavicka"><span>Stopa ${i + 1}</span><span>${i + 1} / ${n}</span></div>${uvod}${telo}`
      + `<div class="pata"><span>${esc(T.nazev.replace(/^\S+\s/, ''))}</span><span>${esc(napoveda)}</span></div>`;
  }
  const dopisHtml = () => `<div class="hlavicka"><span data-i18n="ne">${esc(v.nazev)}</span><span>✦</span></div><div class="dopis" data-i18n="ne">${esc(V.text(v.uvod, v))}</div>${pecet()}`;
  const pokladHtml = () => `<div class="hlavicka"><span>Poklad</span><span>✦</span></div><div data-i18n="ne" class="sifra" style="font-size:1.5rem">${esc(V.text(v.zaver, v))}</div>${pecet()}`;

  /* ---------- 1. příběh ---------- */
  function vyplnSelect(el, obj) { el.innerHTML = Object.entries(obj).map(([k, x]) => `<option value="${k}">${esc(x.nazev)}</option>`).join(''); }
  vyplnSelect($('pVek'), V.VEKY); vyplnSelect($('pMisto'), V.MISTA);
  function vykresliPribeh() {
    $('sablony').innerHTML = Object.entries(V.SABLONY).map(([k, S]) => `<button type="button" data-sablona="${k}" aria-pressed="${v.sablona === k}">${esc(S.nazev)}<small>${S.typy.map(t => esc(V.TYPY[t].nazev.split(' ')[0])).join(' ')}</small></button>`).join('');
    document.querySelectorAll('#v-pribeh [data-pole]').forEach(el => { if (document.activeElement !== el) el.value = v[el.dataset.pole] ?? ''; });
    $('radaMista').textContent = (V.MISTA[v.misto] || {}).rada || '';
    $('nahledDopisu').innerHTML = dopisHtml();
  }
  document.querySelectorAll('#v-pribeh [data-pole]').forEach(el => el.addEventListener('input', () => {
    v[el.dataset.pole] = el.value; uloz();
    $('radaMista').textContent = (V.MISTA[v.misto] || {}).rada || '';
    $('nahledDopisu').innerHTML = dopisHtml(); hlavicka(); stavKroku();
  }));
  $('sablony').addEventListener('click', async e => {
    const b = e.target.closest('[data-sablona]'); if (!b) return;
    const S = V.SABLONY[b.dataset.sablona];
    const vlastni = v.stanoviste.some(s => s.text || s.misto);
    if (!(await Dialog.potvrd(`Použít šablonu „${S.nazev}“? Přepíše dopis, vzkaz u pokladu, poklad${vlastni ? '' : ' a doporučené šifry stanovišť'}.`, { ok: 'Použít' }))) return;
    Object.assign(v, { sablona: b.dataset.sablona, uvod: S.uvod, zaver: S.zaver, poklad: S.poklad });
    if (!vlastni) v.stanoviste = S.typy.map(t => V.noveStanoviste(t));
    uloz(); vse();
  });

  /* ---------- 2. stanoviště ---------- */
  const hvezdy = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  function vykresliSeznamSt() {
    const k = V.zkontroluj(v);
    const stav = i => k.some(x => x.i === i && x.uroven === 'chyba') ? '🔴' : k.some(x => x.i === i && x.uroven === 'varovani') ? '🟡' : '🟢';
    $('seznamSt').innerHTML = `<div class="konec">✉️ Dopis → ${esc(v.prvni || '…')}</div>`
      + v.stanoviste.map((s, i) => `<button type="button" class="polozka" data-st="${i}" aria-selected="${i === vybraneSt}"><span class="c">${i + 1}</span><span class="m">${esc(s.misto || '(kde?)')}</span><span title="${esc(V.TYPY[s.typ].nazev)}">${V.TYPY[s.typ].nazev.split(' ')[0]}</span><span class="znacka-stavu">${stav(i)}</span></button>`).join('')
      + `<div class="konec">🏆 ${esc(v.poklad || 'poklad')}</div>`;
  }
  $('seznamSt').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; vybraneSt = +b.dataset.st; vykresliSeznamSt(); vykresliEditorSt(); });

  function vykresliEditorSt() {
    const s = v.stanoviste[vybraneSt], ed = $('editorSt');
    if (!s) { ed.innerHTML = '<p class="pozn">Přidejte první stanoviště.</p>'; return; }
    const vek = V.VEKY[v.vek];
    const T = V.TYPY[s.typ], dalsi = v.stanoviste[vybraneSt + 1];
    const typy = Object.entries(V.TYPY).map(([k, t]) => `<option value="${k}"${k === s.typ ? ' selected' : ''}>${esc(t.nazev)}  ${hvezdy(t.obtiznost)}${t.obtiznost > vek.maxObtiznost ? '  ⚠' : ''}</option>`).join('');
    const par = [];
    if (s.typ === 'caesar') par.push(`<div class="radek"><div><label for="sPosun">Posun (klíč)</label><input type="number" id="sPosun" min="1" max="25" value="${esc(s.par.posun || 3)}" data-par="posun"></div><div><label>&nbsp;</label><label class="zaskrt"><input type="checkbox" data-par-zaskrt="ukazPosun"${s.par.ukazPosun ? ' checked' : ''}> napsat klíč na kartu</label></div></div>`);
    if (s.typ === 'vigenere') par.push(`<label for="sHeslo">Heslo</label><input type="text" id="sHeslo" value="${esc(s.par.heslo || '')}" data-par="heslo" placeholder="např. MAPA">`);
    if (s.typ === 'zrcadlo') par.push(`<label class="zaskrt"><input type="checkbox" data-par-zaskrt="pozpatku"${s.par.pozpatku ? ' checked' : ''}> místo zrcadlení napsat pozpátku</label>`);
    if (s.typ === 'mrizka') par.push(`<label for="sPole">Políčko na mapě</label><input type="text" id="sPole" value="${esc(s.par.pole || '')}" data-par="pole" placeholder="např. E5" maxlength="2"><p class="pozn">Mřížka A–H × 1–8 se zapne na mapě. Dílna zkontroluje, že na políčku něco je.</p>`);
    if (s.typ === 'kniha') par.push(`<label for="sZdroj">Text, ze kterého se šifruje (každý řádek zvlášť)</label><textarea id="sZdroj" rows="5" data-par="zdroj" placeholder="Opište stránku knihy, nápis z tabule nebo dopis, který hráč dostane.">${esc(s.par.zdroj || '')}</textarea>`);
    if (s.typ === 'pismo') par.push(`<div class="radek"><div><label for="sPrepis">Přepis</label><select id="sPrepis" data-par="prepis"><option value="zadny">Bez přepisu – jen jiný font</option>${PREPISY.filter(p => p.id !== 'zadny').map(p => `<option value="${p.id}"${s.par.prepis === p.id ? ' selected' : ''}>${esc(p.nazev)}</option>`).join('')}</select></div>`
      + `<div><label>Písmo zprávy</label><div id="sFont"></div></div></div><p class="pozn">Nabízí celou knihovnu písem webu včetně vašich nahraných (sdílí se s Převodníkem písma, 3D textem a Písmolijnou).</p>`);
    if (s.typ === 'hadanka' || s.typ === 'zamek') par.push(`<label for="sOtazka">${s.typ === 'zamek' ? 'Úkol, který prozradí kód' : 'Hádanka na kartu'}</label><textarea id="sOtazka" rows="3" data-par="otazka" placeholder="${s.typ === 'zamek' ? 'např. Kolik oken má kaplička? To číslo dvakrát za sebou otevře truhlu.' : 'např. Mám zuby, a nekoušu. Kde mě najdeš? (hrábě)'}">${esc(s.par.otazka || '')}</textarea>`);
    const popisTextu = { hadanka: 'Řešení (kam hádanka vede)', zamek: 'Kód zámku', mrizka: 'Co tam hráč najde (jen do taháku)', neviditelny: 'Zpráva – napište ji citronem na kartu', ptaci: 'Zpráva (otevřený text – vysází se ptačím písmem)' }[s.typ] || 'Zpráva (otevřený text – zašifruje se sama)';
    const nap = [0, 1, 2].map(j => `<input type="text" data-napoveda="${j}" value="${esc((s.napovedy || [])[j] || '')}" placeholder="${['Nápověda 1 – jemné postrčení', 'Nápověda 2 – skoro řešení', 'Nápověda 3 – řešení'][j]}">`).join('');
    const hl = V.zkontroluj(v).filter(x => x.i === vybraneSt);
    ed.innerHTML = `<h3 style="margin:0 0 6px;font-size:1rem">Stanoviště ${vybraneSt + 1}</h3>
      <label for="sMisto">Kde bude karta schovaná</label><input type="text" id="sMisto" value="${esc(s.misto)}" placeholder="např. v konvi u záhonu">
      <label for="sTyp">Úkol</label><select id="sTyp">${typy}</select>
      <div class="typy-popis">${esc(T.popis)}</div>
      <label for="sUvodKarty">Úvodní věta na kartě <span class="pozn">– nepovinné, např. „Kapitán ti vzkazuje:“</span></label><input type="text" id="sUvodKarty" value="${esc(s.uvodKarty || '')}">
      ${par.join('')}
      <label for="sText">${popisTextu}</label><textarea id="sText" rows="3">${esc(s.text)}</textarea>
      ${dalsi ? `<button class="tl male" data-prikaz="doplnDalsi" style="margin-top:5px">↪ Doplnit další místo: <span data-i18n="ne">${esc(dalsi.misto || '…')}</span></button>` : `<button class="tl male" data-prikaz="doplnDalsi" style="margin-top:5px">↪ Doplnit poklad</button>`}
      <label>Nápovědy do obálek</label><div class="napovedy">${nap}</div>
      <label for="sPozn">Poznámka pro vás (rekvizita, co připravit)</label><input type="text" id="sPozn" value="${esc(s.poznamka || '')}">
      <ul class="hlaseni">${hl.map(x => `<li class="${x.uroven}">${esc(x.text)}</li>`).join('')}</ul>
      <div class="nahled-karty pergamen" id="nahledKarty">${kartaHtml(s, vybraneSt)}</div>`;
    if (s.typ === 'pismo') vyberPisma($('sFont'), () => s.par.font || PREPIS_FONT[s.par.prepis] || '', id => { s.par.font = id; poZmeneSt(false); },
      () => (s.par.prepis && s.par.prepis !== 'zadny' ? s.par.prepis : 'latinka'), () => V.sifruj('pismo', s.text || 'Aa', s.par).zapis);
  }
  function poZmeneSt(celyEditor) {
    uloz(); vykresliSeznamSt(); stavKroku();
    if (celyEditor) vykresliEditorSt();
    else {
      $('nahledKarty').innerHTML = kartaHtml(v.stanoviste[vybraneSt], vybraneSt);
      const hl = V.zkontroluj(v).filter(x => x.i === vybraneSt);
      $('editorSt').querySelector('.hlaseni').innerHTML = hl.map(x => `<li class="${x.uroven}">${esc(x.text)}</li>`).join('');
    }
  }
  $('editorSt').addEventListener('input', e => {
    const s = v.stanoviste[vybraneSt], t = e.target;
    if (!s) return;
    if (t.id === 'sMisto') s.misto = t.value;
    else if (t.id === 'sText') s.text = t.value;
    else if (t.id === 'sPozn') s.poznamka = t.value;
    else if (t.id === 'sUvodKarty') s.uvodKarty = t.value;
    else if (t.dataset.par) s.par[t.dataset.par] = t.type === 'number' ? +t.value : t.value;
    else if (t.dataset.parZaskrt) s.par[t.dataset.parZaskrt] = t.checked;
    else if (t.dataset.napoveda != null) { s.napovedy[+t.dataset.napoveda] = t.value; s.napovedy = s.napovedy.map(x => x || ''); }
    poZmeneSt(false);
  });
  $('editorSt').addEventListener('change', e => {
    if (e.target.id === 'sPrepis') {   // k přepisu rovnou doporučený font, ať se znaky vykreslí
      const s = v.stanoviste[vybraneSt]; s.par.prepis = e.target.value; s.par.font = PREPIS_FONT[s.par.prepis] || s.par.font || '';
      return poZmeneSt(true);
    }
    if (e.target.id !== 'sTyp') return;
    const st = v.stanoviste[vybraneSt];
    st.typ = e.target.value;
    if (st.typ === 'pismo' && !st.par.prepis) { st.par.prepis = 'runy'; st.par.font = PREPIS_FONT.runy || ''; }
    poZmeneSt(true);
  });

  /* ---------- 3. mapa ---------- */
  let mapaRezim = 'vyber', pridavanyTyp = null, tah = null;
  $('ikonyZnacek').innerHTML = Object.entries(MP.ZNACKY).map(([k, n]) => `<button class="tl ik" data-pridej-znacku="${k}" title="Přidat: ${esc(n)}" aria-pressed="false">${{ strom: '🌳', les: '🌲', hora: '⛰️', skala: '🪨', dum: '🏠', chram: '🏛️', studna: '🪣', most: '🌉', voda: '💧', lod: '⛵', lebka: '💀', stanoviste: '①', poklad: '❌', text: '🔤' }[k]}</button>`).join('');
  function nastavRezim(r, typ) {
    mapaRezim = r; pridavanyTyp = typ || null;
    document.querySelectorAll('[data-mapa-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapaRezim === r)));
    document.querySelectorAll('[data-pridej-znacku]').forEach(b => b.setAttribute('aria-pressed', String(r === 'pridat' && b.dataset.pridejZnacku === typ)));
    $('platnoMapy').className = 'platno-mapy rezim-' + r;
  }
  document.querySelectorAll('[data-mapa-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.mapaRezim)));
  $('ikonyZnacek').addEventListener('click', e => { const b = e.target.closest('[data-pridej-znacku]'); if (b) nastavRezim('pridat', b.dataset.pridejZnacku); });
  document.querySelectorAll('[data-mapa-pole]').forEach(el => el.addEventListener('change', () => { v.mapa[el.dataset.mapaPole] = el.checked; uloz(); vykresliMapu(); stavKroku(); }));
  $('mNazev').addEventListener('input', e => { v.mapa.nazev = e.target.value; uloz(); kresliSvg(); });
  $('mMeritko').addEventListener('input', e => { v.mapa.meritko = e.target.value; uloz(); kresliSvg(); });
  function kresliSvg() { $('platnoMapy').innerHTML = MP.svg(v.mapa, Object.assign(volbyMapy(), { interaktivni: true, vybrana: vybranaZnacka })); }
  function vykresliMapu() {
    document.querySelectorAll('[data-mapa-pole]').forEach(el => { el.checked = !!v.mapa[el.dataset.mapaPole]; });
    if (document.activeElement !== $('mNazev')) $('mNazev').value = v.mapa.nazev || '';
    if (document.activeElement !== $('mMeritko')) $('mMeritko').value = v.mapa.meritko || '';
    kresliSvg(); detailZnacky();
  }
  function detailZnacky() {
    const z = v.mapa.znacky.find(x => x.id === vybranaZnacka), d = $('detailZnacky');
    if (!z) { d.innerHTML = '<p class="pozn">Klikněte na značku – půjde popsat nebo smazat.</p>'; return; }
    const pole = v.mapa.mrizka ? ` · políčko ${V.xyNaPole(z.x, z.y) || '–'}` : '';
    d.innerHTML = `<label for="zPopis">${esc(MP.ZNACKY[z.typ])}${pole}</label><div class="radek" style="flex-wrap:nowrap;align-items:center"><input type="text" id="zPopis" value="${esc(z.popis || '')}" placeholder="${z.typ === 'stanoviste' ? 'číslo' : 'popisek'}">`
      + `<input type="range" id="zVelikost" min="0.5" max="2.5" step="0.1" value="${esc(z.velikost || 1)}" title="Velikost značky" aria-label="Velikost značky" style="flex:0 0 110px">`
      + `<button class="tl" data-prikaz="smazZnacku" style="flex:0">🗑️</button></div>`;
  }
  $('detailZnacky').addEventListener('input', e => {
    const z = v.mapa.znacky.find(x => x.id === vybranaZnacka);
    if (z && e.target.id === 'zPopis') { z.popis = e.target.value; uloz(); kresliSvg(); }
    if (z && e.target.id === 'zVelikost') { z.velikost = +e.target.value; uloz(); kresliSvg(); }
  });
  function bodMapy(e) {
    const r = $('platnoMapy').querySelector('svg').getBoundingClientRect();
    return { x: Math.round((e.clientX - r.left) / r.width * MP.W), y: Math.round((e.clientY - r.top) / r.height * MP.H) };
  }
  $('platnoMapy').addEventListener('pointerdown', e => {
    const g = e.target.closest('.znacka'), p = bodMapy(e);
    if (mapaRezim === 'pridat') {
      const z = { id: V.noveId(), typ: pridavanyTyp, x: p.x, y: p.y, popis: pridavanyTyp === 'stanoviste' ? String(v.mapa.znacky.filter(x => x.typ === 'stanoviste').length + 1) : '' };
      v.mapa.znacky.push(z); vybranaZnacka = z.id; uloz(); kresliSvg(); detailZnacky(); stavKroku();
      return;
    }
    if (!g) { vybranaZnacka = null; kresliSvg(); detailZnacky(); return; }
    const z = v.mapa.znacky.find(x => x.id === g.dataset.id);
    if (!z) return;
    if (mapaRezim === 'trasa') {
      if (v.mapa.trasa[v.mapa.trasa.length - 1] !== z.id) v.mapa.trasa.push(z.id);
      uloz(); kresliSvg(); return;
    }
    vybranaZnacka = z.id; tah = { z, dx: z.x - p.x, dy: z.y - p.y };
    $('platnoMapy').setPointerCapture(e.pointerId);
    kresliSvg(); detailZnacky();
  });
  $('platnoMapy').addEventListener('pointermove', e => {
    if (!tah) return;
    const p = bodMapy(e);
    tah.z.x = Math.max(20, Math.min(MP.W - 20, p.x + tah.dx)); tah.z.y = Math.max(20, Math.min(MP.H - 20, p.y + tah.dy));
    kresliSvg();
  });
  const konecTahu = () => { if (tah) { tah = null; uloz(); detailZnacky(); stavKroku(); } };
  $('platnoMapy').addEventListener('pointerup', konecTahu);
  $('platnoMapy').addEventListener('pointercancel', konecTahu);

  /* Export mapy: zvolené písmo se vloží do SVG (obrázek z SVG nevidí písma stránky). */
  const fontyMapy = {};
  async function svgKExportu() {
    const id = v.vzhled.pismoMapy || 'imfell';
    if (!(id in fontyMapy)) {
      try {
        const buf = typeof FONTY !== 'undefined' ? await FONTY.data(id) : await (await fetch('fonty/IMFellEnglish-Regular.ttf')).arrayBuffer();
        fontyMapy[id] = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(new Blob([buf], { type: 'font/ttf' })); });
      } catch (e) { fontyMapy[id] = ''; }
    }
    return MP.svg(v.mapa, Object.assign(volbyMapy(), { fontData: fontyMapy[id] }));
  }
  async function mapaPng() {
    const svg = await svgKExportu();
    const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await new Promise((ok, chyba) => { img.onload = ok; img.onerror = chyba; img.src = url; });
    const c = document.createElement('canvas'); c.width = MP.W * 2; c.height = MP.H * 2;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => stahni(b, souborNazev() + '-mapa.png'), 'image/png');
  }

  /* ---------- 4. kontrola ---------- */
  function vykresliKontrolu() {
    const k = V.zkontroluj(v), st = v.stanoviste;
    const pocet = u => k.filter(x => x.uroven === u).length;
    const max = Math.max(0, ...st.map(s => V.TYPY[s.typ].obtiznost));
    $('souhrn').innerHTML = `<div><b>${st.length}</b>stanovišť</div><div><b>~${V.odhadCasu(v)} min</b>odhad hry</div><div><b>${hvezdy(max)}</b>nejtěžší úkol</div>`
      + `<div><b>${pocet('chyba')}</b>chyb</div><div><b>${pocet('varovani')}</b>varování</div><div><b>${pocet('tip')}</b>tipů</div>`;
    const bod = (stav, obsah, znak) => `<div class="clanek"><div class="bod ${stav}">${znak}</div><div class="obsah">${obsah}</div></div>`;
    let h = bod(v.prvni ? (st[0] && !V.vedeNa(v.prvni, st[0].misto) ? 'pozor' : 'ok') : 'spatne', `<b>✉️ Úvodní dopis</b><span class="sip">posílá: ${esc(v.prvni || '— chybí —')}</span>`, '✉');
    st.forEach((s, i) => {
      const T = V.TYPY[s.typ], dalsi = st[i + 1];
      const chyby = k.some(x => x.i === i && x.uroven === 'chyba'), pozor = k.some(x => x.i === i && x.uroven === 'varovani');
      const reseni = s.typ === 'mrizka' ? 'políčko ' + (s.par.pole || '?') + ' na mapě' : s.typ === 'zamek' ? 'kód ' + (s.text || '?') : (s.text || '— chybí —');
      h += bod(chyby ? 'spatne' : pozor ? 'pozor' : 'ok', `<b>${esc(s.misto || '(kde?)')}</b>${esc(T.nazev)} · ${hvezdy(T.obtiznost)}<br><span class="sip">řešení: „${esc(reseni)}“ → ${esc(dalsi ? dalsi.misto || '…' : '🏆 ' + (v.poklad || 'poklad'))}</span>`, i + 1);
    });
    h += bod('ok', `<b>🏆 ${esc(v.poklad || 'Poklad')}</b><span class="sip">${esc(V.text(v.zaver, v))}</span>`, '★');
    $('retez').innerHTML = h;
    kontrolaPisma().then(np => {
      if (!np.length || data.krok !== 'kontrola') return;
      const ul = $('nalezy');
      if (ul.querySelector('.tip:only-child') && !k.length) ul.innerHTML = '';
      ul.insertAdjacentHTML('beforeend', np.map(x => `<li class="${x.uroven}">🔤 ${esc(x.text)}</li>`).join(''));
    });
    const poradi = { chyba: 0, varovani: 1, tip: 2 };
    $('nalezy').innerHTML = k.length ? k.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]).map(x => `<li class="${x.uroven}">${{ chyba: '⛔', varovani: '⚠️', tip: '💡' }[x.uroven]} ${esc(x.text)}</li>`).join('')
      : '<li class="tip">✔ Řetěz vypadá v pořádku. Teď ho dejte vyzkoušet někomu, kdo hru nezná.</li>';
  }

  /* ---------- 5. tisk ---------- */
  const TISK = { dopis: '✉️ Úvodní dopis', karty: '🃏 Karty stanovišť a poklad', napovedy: '🆘 Nápovědy do obálek', pomucky: '🧰 Pomůcky k luštění', mapa: '🗺️ Mapa pokladu', tahak: '📋 Tahák pro tvůrce' };
  for (const k in TISK) if (data.tisk[k] == null) data.tisk[k] = true;
  $('tiskVolby').innerHTML = Object.entries(TISK).map(([k, n]) => `<label class="zaskrt"><input type="checkbox" data-tisk="${k}"${data.tisk[k] ? ' checked' : ''}> ${n}</label>`).join('');
  $('tiskVolby').addEventListener('change', e => { const k = e.target.dataset.tisk; if (k) { data.tisk[k] = e.target.checked; uloz(); vykresliTisk(); } });

  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function koleckoSvg() {
    const kruh = (cx, cy, r, rText, velikost, nazev) => {
      let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbf6ea" stroke="#3d2714" stroke-width=".6"/>`;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * 2 * Math.PI - Math.PI / 2, a2 = a + Math.PI / 26;
        s += `<line x1="${(cx + Math.cos(a2) * (rText - 7)).toFixed(2)}" y1="${(cy + Math.sin(a2) * (rText - 7)).toFixed(2)}" x2="${(cx + Math.cos(a2) * r).toFixed(2)}" y2="${(cy + Math.sin(a2) * r).toFixed(2)}" stroke="#3d2714" stroke-width=".3"/>`;
        const x = cx + Math.cos(a + Math.PI / 26) * rText, y = cy + Math.sin(a + Math.PI / 26) * rText, rot = (i + 0.5) / 26 * 360;
        s += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${velikost}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rot.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="#3d2714" font-family="IM Fell English, Georgia, serif">${ABC[i]}</text>`;
      }
      return s + `<circle cx="${cx}" cy="${cy}" r="1.2" fill="#3d2714"/><text x="${cx}" y="${cy + 12}" font-size="4" text-anchor="middle" fill="#3d2714" font-family="IM Fell English, Georgia, serif">${nazev}</text>`;
    };
    return `<svg viewBox="0 0 190 262" style="width:auto;height:235mm;display:block;margin:0 auto">${kruh(95, 72, 70, 63, 8, 'otevřený text')}${kruh(95, 204, 54, 47, 7.5, 'šifra')}</svg>`;
  }
  function zednarskaKlicSvg() {
    const tah = 'stroke="#3d2714" stroke-width="1.2" fill="none"';
    const mriz = (x0, y0, pismena, tecka) => {
      let s = `<path d="M${x0 + 20} ${y0}V${y0 + 60}M${x0 + 40} ${y0}V${y0 + 60}M${x0} ${y0 + 20}H${x0 + 60}M${x0} ${y0 + 40}H${x0 + 60}" ${tah}/>`;
      [...pismena].forEach((c, i) => { const x = x0 + (i % 3) * 20 + 10, y = y0 + Math.floor(i / 3) * 20 + 10; s += `<text x="${x}" y="${y + 3.5}" font-size="10" text-anchor="middle" fill="#3d2714">${c}</text>` + (tecka ? `<circle cx="${x + 5}" cy="${y - 5}" r="1.4" fill="#3d2714"/>` : ''); });
      return s;
    };
    const kriz = (x0, y0, pismena, tecka) => {
      let s = `<path d="M${x0} ${y0}L${x0 + 60} ${y0 + 60}M${x0 + 60} ${y0}L${x0} ${y0 + 60}" ${tah}/>`;
      [[30, 12], [48, 30], [30, 48], [12, 30]].forEach(([dx, dy], i) => { s += `<text x="${x0 + dx}" y="${y0 + dy + 3.5}" font-size="10" text-anchor="middle" fill="#3d2714">${pismena[i]}</text>` + (tecka ? `<circle cx="${x0 + dx + 6}" cy="${y0 + dy - 4}" r="1.4" fill="#3d2714"/>` : ''); });
      return s;
    };
    return `<svg viewBox="0 0 290 75" style="width:180mm">${mriz(5, 5, 'ABCDEFGHI')}${mriz(78, 5, 'JKLMNOPQR', true)}${kriz(152, 5, 'STUV')}${kriz(225, 5, 'WXYZ', true)}</svg>`;
  }
  const PTACI_KLIC = [...'aábcčdďeéěfgh', 'ch', ...'iíjklmnňoópqrřsštťuúůvwxyýzž', ...'0123456789'];
  const PTACI_ZNAKY = [['narozeni', 'narození'], ['umrti', 'úmrtí'], ['lovec', 'lovec'], ['korist', 'kořist'], ['merin', 'Merin'], ['shora', 'shora'], ['zdola', 'zdola'], ['zlesa', 'z lesa'], ['zvody', 'z vody'], ['zhory', 'z hory'], ['zvenku', 'zvenku']];
  function pomuckaHtml(id) {
    switch (id) {
      case 'kolecko': return `<h3>🎡 Šifrovací kolečko</h3><p style="margin:0;font-size:.85rem">Vystřihněte oba kruhy, menší položte na větší a spojte uprostřed patentkou nebo špendlíkem. Posun 3 = pod A vnějšího kruhu nastavte D.</p><div class="pomucka">${koleckoSvg()}</div>`;
      case 'a1z26': return `<h3>🔢 Proužek abecedy</h3><table class="klic-tab">${[0, 13].map(o => `<tr>${[...ABC.slice(o, o + 13)].map(c => `<td>${c}</td>`).join('')}</tr><tr>${[...ABC.slice(o, o + 13)].map((c, i) => `<td>${o + i + 1}</td>`).join('')}</tr>`).join('')}</table>`;
      case 'morse': return `<h3>📡 Morseova abeceda</h3><table class="klic-tab">${Array.from({ length: 9 }, (_, r) => `<tr>${[0, 9, 18, 27].map(c => { const k = Object.keys(V.MORSE)[r + c]; return k ? `<td><b>${k}</b></td><td style="font-family:monospace;letter-spacing:.15em">${V.MORSE[k].replace(/\./g, '•').replace(/-/g, '−')}</td>` : '<td></td><td></td>'; }).join('')}</tr>`).join('')}</table>`;
      case 'zednarska': return `<h3>#️⃣ Klíč zednářské šifry</h3><p style="margin:0;font-size:.85rem">Písmeno je kousek mřížky nebo kříže, ve kterém leží; tečka = druhá mřížka.</p><div class="pomucka" style="color:#3d2714">${zednarskaKlicSvg()}</div>`;
      case 'ptaci': return `<h3>🐦 Klíč ptačího písma</h3><div class="klic-ptaci">${PTACI_KLIC.map(c => `<div><span>${esc(c)}</span>${esc(c)}</div>`).join('')}${PTACI_ZNAKY.map(([k, n]) => `<div><span>[${k}]</span>${esc(n)}</div>`).join('')}</div>`;
      case 'atbash': return `<h3>🔄 Obrácená abeceda (Atbaš)</h3><table class="klic-tab"><tr>${[...ABC].map(c => `<td>${c}</td>`).join('')}</tr><tr>${[...ABC].reverse().map(c => `<td>${c}</td>`).join('')}</tr></table>`;
      case 'vigenere': return `<h3>🗝️ Vigenèrova tabulka</h3><table class="klic-tab" style="font-size:9px;font-family:monospace">${[...ABC].map((_, r) => `<tr>${[...ABC].map((__, c) => `<td style="padding:0 2px">${ABC[(r + c) % 26]}</td>`).join('')}</tr>`).join('')}</table>`;
      default: return '';
    }
  }
  function vykresliTisk() {
    const archy = [], t = data.tisk, st = v.stanoviste;
    const arch = (obsah, trida) => archy.push(`<div class="arch${trida ? ' ' + trida : ''}">${obsah}</div>`);
    if (t.dopis) arch(`<div class="pergamen">${dopisHtml()}</div>`);
    if (t.karty) {
      const karty = st.map((s, i) => `<div class="pergamen">${kartaHtml(s, i)}</div>`).concat([`<div class="pergamen">${pokladHtml()}</div>`]);
      const n = [1, 2, 4].includes(+v.vzhled.karet) ? +v.vzhled.karet : 2;
      for (let i = 0; i < karty.length; i += n) arch(karty.slice(i, i + n).join(''), 'karet-' + n);
    }
    if (t.napovedy) {
      const ob = [];
      st.forEach((s, i) => (s.napovedy || []).forEach((n, j) => { if (String(n).trim()) ob.push(`<div class="obalka"><span class="nad">Stopa ${i + 1} · nápověda ${j + 1} – otevři jen v nouzi</span><span style="font-size:1.15rem" data-i18n="ne">${esc(n)}</span></div>`); }));
      for (let i = 0; i < ob.length; i += 10) arch(`<h3>Nápovědy do obálek</h3><div class="mrizka-karet">${ob.slice(i, i + 10).join('')}</div>`);
    }
    if (t.pomucky) {
      const pom = [...new Set(st.map(s => V.TYPY[s.typ].pomucka).filter(p => p && p !== 'mapa' && p !== 'kniha'))];
      const male = pom.filter(p => p !== 'kolecko' && p !== 'vigenere');
      if (pom.includes('kolecko')) arch(pomuckaHtml('kolecko'));
      if (pom.includes('vigenere')) arch(pomuckaHtml('vigenere'));
      if (male.length) arch(male.map(pomuckaHtml).join('<hr style="width:100%;border:0;border-top:1px dashed #bbb">'));
      // klíče cizích písem – jeden pro každou dvojici přepis + font
      const pisma = new Map();
      st.forEach(s => { if (s.typ === 'pismo') { const f = s.par.font || PREPIS_FONT[s.par.prepis] || ''; pisma.set((s.par.prepis || 'zadny') + '|' + f, { par: s.par, font: f }); } });
      for (const { par, font } of pisma.values()) {
        const pr = PREPISY.find(x => x.id === par.prepis);
        const znaky = [...'abcčdďeéěfghijklmnňoópqrřsštťuúůvwxyýzž0123456789'];
        arch(`<h3>🔣 Klíč písma${pr && pr.id !== 'zadny' ? ' – ' + esc(pr.nazev) : ''}</h3><div class="klic-ptaci">`
          + znaky.map(c => `<div><span style="font-family:${esc(pismo(font))}">${esc(V.sifruj('pismo', c, par).zapis)}</span>${esc(c)}</div>`).join('') + '</div>');
      }
      st.forEach((s, i) => {
        if (s.typ === 'kniha' && s.par.zdroj) arch(`<div class="pergamen"><div class="hlavicka"><span>Text ke stopě ${i + 1}</span><span>✦</span></div><ol style="font-size:1.1rem;line-height:1.7" data-i18n="ne">${String(s.par.zdroj).split(/\r?\n/).map(r => `<li>${esc(r)}</li>`).join('')}</ol></div>`);
      });
    }
    if (t.mapa && v.mapa.znacky.length) arch(`<h3>${esc(v.mapa.nazev || 'Mapa pokladu')}</h3><div class="pomucka" data-i18n="ne">${MP.svg(v.mapa, volbyMapy())}</div><p style="font-size:.8rem;color:#666;margin:0">Mapu jde stáhnout i jako PNG v kroku Mapa pokladu.</p>`);
    if (t.tahak) {
      const harm = V.harmonogram(v);
      const radky = st.map((s, i) => {
        const T = V.TYPY[s.typ];
        const klic = s.typ === 'caesar' ? 'posun ' + (s.par.posun || 3) : s.typ === 'vigenere' ? 'heslo ' + (s.par.heslo || '?') : s.typ === 'mrizka' ? 'políčko ' + (s.par.pole || '?') : '';
        return `<tr><td>${i + 1}</td>${harm ? `<td>${harm[i]}</td>` : ''}<td>${esc(s.misto)}</td><td>${esc(T.nazev)}</td><td>${esc(s.typ === 'hadanka' || s.typ === 'zamek' ? (s.par.otazka || '') + ' → ' + s.text : s.text)}</td><td>${esc(klic)}</td><td>${(s.napovedy || []).filter(Boolean).map(esc).join('<br>')}</td><td>${esc(s.poznamka || '')}</td></tr>`;
      }).join('');
      const pom = [...new Set(st.map(s => V.TYPY[s.typ].pomucka).filter(Boolean))];
      const ukoly = ['Vytisknout karty a zestárnout je čajem', `Připravit poklad: ${v.poklad || '…'}`, 'Karty do sáčků nebo obálek', 'Rozmístit od konce – poslední stopu jako první',
        ...pom.map(p => `Pomůcka: ${{ kolecko: 'šifrovací kolečko', a1z26: 'proužek abecedy', morse: 'tabulka Morseovky', zednarska: 'klíč zednářské šifry', ptaci: 'klíč ptačího písma', atbash: 'obrácená abeceda', vigenere: 'Vigenèrova tabulka', mapa: 'mapa pokladu', kniha: 'text ke knižní šifře', pismo: 'klíč cizího písma' }[p]} – kam ji dát?`),
        'Nápovědy do obálek a k sobě', 'Projít trasu a zkontrolovat bezpečnost', `Předat úvodní dopis (${esc(v.hrac || 'hráči')})`, 'Po hře vše posbírat'];
      arch(`<h3>📋 Tahák – ${esc(v.nazev)}</h3><p style="margin:0;font-size:.85rem">Pro: ${esc(v.hrac || '–')} · ${esc(V.VEKY[v.vek].nazev)} · ${esc(V.MISTA[v.misto].nazev)} · odhad ~${V.odhadCasu(v)} min · první stopa: ${esc(v.prvni || '–')}</p>`
        + (harm ? `<p style="margin:0;font-size:.85rem">Začátek ${esc(v.start)} · u pokladu asi v ${harm[harm.length - 1]}</p>` : '')
        + `<table class="tahak"><tr><th>#</th>${harm ? '<th>Čas</th>' : ''}<th>Kde schovat</th><th>Úkol</th><th>Řešení</th><th>Klíč</th><th>Nápovědy</th><th>Poznámka</th></tr>${radky}</table>`
        + `<h3 style="font-size:1.05rem">Příprava</h3><ul class="zaskrtavatko">${ukoly.map(u => `<li>${u}</li>`).join('')}</ul>`);
    }
    $('archy').innerHTML = archy.join('') || '<p class="pozn">Vyberte, co vytisknout.</p>';
  }

  /* ---------- kroky, hlavička, výpravy ---------- */
  const KROKY = ['pribeh', 'stanoviste', 'mapa', 'kontrola', 'tisk', 'rady'];
  function prepniKrok(k) {
    if (!KROKY.includes(k)) k = 'pribeh';
    data.krok = k; uloz();
    for (const x of KROKY) $('v-' + x).hidden = x !== k;
    document.querySelectorAll('[data-krok]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.krok === k)));
    vykresliKrok();
  }
  /* Po načtení písma překreslit jen náhledy – editor se nesmí překreslit pod rukama. */
  function obnovNahledy() {
    const k = data.krok;
    if (k === 'pribeh') $('nahledDopisu').innerHTML = dopisHtml();
    if (k === 'stanoviste' && $('nahledKarty') && v.stanoviste[vybraneSt]) $('nahledKarty').innerHTML = kartaHtml(v.stanoviste[vybraneSt], vybraneSt);
    if (k === 'mapa') kresliSvg();
    if (k === 'tisk') vykresliTisk();
  }

  /* ---------- vzhled (krok Tisk) ---------- */
  const vyplnVolby = (el, obj) => { el.innerHTML = Object.entries(obj).map(([k, x]) => `<option value="${k}">${esc(Array.isArray(x) ? x[0] : x)}</option>`).join(''); };
  vyplnVolby($('vzPapir'), V.PAPIRY); vyplnVolby($('vzInkoust'), V.INKOUSTY); vyplnVolby($('vzBarvaPecete'), V.PECETI);
  vyberPisma($('vzPismo'), () => v.vzhled.pismo, id => { v.vzhled.pismo = id; uloz(); aplikujVzhled(); vykresliTisk(); ukazKontroluPisma(); },
    () => 'latinka', () => v.nazev || 'Aa Čř');
  vyberPisma($('vzPismoMapy'), () => v.vzhled.pismoMapy, id => { v.vzhled.pismoMapy = id; uloz(); vykresliTisk(); ukazKontroluPisma(); },
    () => 'latinka', () => v.mapa.nazev || 'Mapa pokladu');
  document.querySelectorAll('[data-vzhled]').forEach(el => el.addEventListener('input', () => {
    const k = el.dataset.vzhled;
    v.vzhled[k] = k === 'karet' ? +el.value : el.value;
    uloz(); aplikujVzhled(); vykresliTisk();
  }));
  function vykresliVzhled() {
    document.querySelectorAll('[data-vzhled]').forEach(el => { if (document.activeElement !== el) el.value = v.vzhled[el.dataset.vzhled] ?? ''; });
    obnovVybery();
    ukazKontroluPisma();
  }
  function ukazKontroluPisma() {
    $('kontrolaPisma').innerHTML = '<li class="tip">🔤 Kontroluji písma…</li>';
    kontrolaPisma().then(np => {
      $('kontrolaPisma').innerHTML = np.length ? np.map(x => `<li class="${x.uroven}">🔤 ${esc(x.text)}</li>`).join('') : '<li class="tip">🔤 Vybraná písma mají všechny potřebné znaky.</li>';
    });
  }

  function vykresliKrok() {
    const k = data.krok;
    if (k === 'pribeh') vykresliPribeh();
    if (k === 'stanoviste') { vybraneSt = Math.min(vybraneSt, v.stanoviste.length - 1); if (vybraneSt < 0) vybraneSt = 0; vykresliSeznamSt(); vykresliEditorSt(); }
    if (k === 'mapa') vykresliMapu();
    if (k === 'kontrola') vykresliKontrolu();
    if (k === 'tisk') { vykresliVzhled(); vykresliTisk(); }
  }
  function stavKroku() {
    const k = V.zkontroluj(v);
    const chyba = k.some(x => x.uroven === 'chyba'), stChyba = k.some(x => x.uroven === 'chyba' && x.i >= 0);
    const stav = {
      pribeh: v.prvni && v.uvod ? 'hotovo' : '',
      stanoviste: !v.stanoviste.length ? '' : stChyba ? 'problem' : 'hotovo',
      mapa: v.mapa.znacky.length ? 'hotovo' : '',
      kontrola: chyba ? 'problem' : k.some(x => x.uroven === 'varovani') ? '' : 'hotovo'
    };
    document.querySelectorAll('[data-krok]').forEach(b => { b.classList.toggle('hotovo', stav[b.dataset.krok] === 'hotovo'); b.classList.toggle('problem', stav[b.dataset.krok] === 'problem'); });
  }
  function hlavicka() {
    $('nazevVypravy').textContent = v.nazev || '';
    $('seznamVyprav').innerHTML = Object.values(data.vypravy).sort((a, b) => b.zmeneno - a.zmeneno)
      .map(x => `<button class="tl" data-otevri="${esc(x.id)}">${x.id === v.id ? '✓ ' : ''}${esc(x.nazev || '(bez názvu)')}</button>`).join('');
  }
  function vse() { hlavicka(); stavKroku(); vykresliKrok(); }
  function otevri(id) { v = data.vypravy[id]; data.aktivni = id; vybraneSt = 0; vybranaZnacka = null; uloz(); aplikujVzhled(); novaHistorie(); vse(); }

  async function nactiSoubor() {
    const i = $('soubor'); i.value = '';
    const f = await new Promise(ok => { i.onchange = () => ok(i.files[0] || null); i.click(); });
    if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      if (!x || !Array.isArray(x.stanoviste)) throw new Error('V souboru není výprava.');
      const nova = V.normalizuj(x); nova.id = V.noveId();
      data.vypravy[nova.id] = nova; otevri(nova.id); zprava('Výprava načtena.');
    } catch (e) { Dialog.chyba('Soubor nejde načíst: ' + e.message); }
  }

  const PRIKAZY = {
    nova: () => { const n = V.novaVyprava('chram'); n.nazev = 'Nová výprava'; data.vypravy[n.id] = n; otevri(n.id); prepniKrok('pribeh'); zprava('Nová výprava – vyberte šablonu příběhu.'); },
    ukazka: () => { const n = V.ukazka(); data.vypravy[n.id] = n; otevri(n.id); zprava('Ukázková výprava je připravená.'); },
    ulozSoubor: () => stahni(JSON.stringify(v, null, 1), souborNazev() + '.vyprava.json', 'application/json'),
    nactiSoubor,
    duplikat: () => { const n = V.normalizuj(JSON.parse(JSON.stringify(v))); n.id = V.noveId(); n.nazev += ' (kopie)'; data.vypravy[n.id] = n; otevri(n.id); },
    smaz: async () => {
      if (!(await Dialog.potvrd(`Smazat výpravu „${v.nazev}“? Nejde to vrátit.`, { ok: 'Smazat' }))) return;
      delete data.vypravy[v.id];
      const zbyva = Object.keys(data.vypravy);
      if (!zbyva.length) { const n = V.novaVyprava('chram'); data.vypravy[n.id] = n; zbyva.push(n.id); }
      otevri(zbyva[0]);
    },
    'krok-kontrola': () => prepniKrok('kontrola'), 'krok-tisk': () => prepniKrok('tisk'), 'krok-rady': () => prepniKrok('rady'),
    zpet, znovu,
    vzhled: () => { prepniKrok('tisk'); $('vzhled').scrollIntoView({ block: 'start' }); },
    duplikujSt: () => {
      const s = v.stanoviste[vybraneSt]; if (!s) return;
      const k = JSON.parse(JSON.stringify(s)); k.id = V.noveId();
      v.stanoviste.splice(vybraneSt + 1, 0, k); vybraneSt++; poZmeneSt(true);
    },
    pridejSt: () => { v.stanoviste.splice(vybraneSt + 1, 0, V.noveStanoviste('hadanka')); vybraneSt++; poZmeneSt(true); },
    smazSt: async () => {
      if (!v.stanoviste.length || !(await Dialog.potvrd(`Smazat stanoviště ${vybraneSt + 1}?`, { ok: 'Smazat' }))) return;
      v.stanoviste.splice(vybraneSt, 1); vybraneSt = Math.max(0, vybraneSt - 1); poZmeneSt(true);
    },
    nahoruSt: () => { const i = vybraneSt; if (i < 1) return; [v.stanoviste[i - 1], v.stanoviste[i]] = [v.stanoviste[i], v.stanoviste[i - 1]]; vybraneSt--; poZmeneSt(true); },
    doluSt: () => { const i = vybraneSt; if (i >= v.stanoviste.length - 1) return; [v.stanoviste[i + 1], v.stanoviste[i]] = [v.stanoviste[i], v.stanoviste[i + 1]]; vybraneSt++; poZmeneSt(true); },
    doplnDalsi: () => {
      const s = v.stanoviste[vybraneSt], dalsi = v.stanoviste[vybraneSt + 1];
      const cil = dalsi ? dalsi.misto : (v.poklad ? 'poklad: ' + v.poklad : 'poklad');
      if (!cil) return zprava('Další stanoviště ještě nemá místo.');
      s.text = (s.text ? s.text.trim() + ' ' : (dalsi ? 'Další stopa je ' : 'Hledej ')) + cil;
      poZmeneSt(true);
    },
    smazZnacku: () => {
      v.mapa.znacky = v.mapa.znacky.filter(z => z.id !== vybranaZnacka);
      v.mapa.trasa = v.mapa.trasa.filter(id => id !== vybranaZnacka);
      vybranaZnacka = null; uloz(); vykresliMapu(); stavKroku();
    },
    mapaStanoviste: () => {
      const n = v.stanoviste.length, uz = v.mapa.znacky.filter(z => z.typ === 'stanoviste').map(z => z.popis);
      for (let i = 1; i <= n; i++) if (!uz.includes(String(i))) v.mapa.znacky.push({ id: V.noveId(), typ: 'stanoviste', popis: String(i), x: 120 + (i - 1) * Math.min(90, 700 / n), y: MP.H - 150 });
      if (!v.mapa.znacky.some(z => z.typ === 'poklad')) v.mapa.znacky.push({ id: V.noveId(), typ: 'poklad', popis: '', x: MP.W - 300, y: 200 });
      uloz(); vykresliMapu(); stavKroku(); zprava('Značky jsou dole na mapě – přetáhněte je na místa.');
    },
    mapaTrasaPryc: () => { v.mapa.trasa = []; uloz(); kresliSvg(); },
    mapaPapir: () => { v.mapa.seed = Math.floor(Math.random() * 1e6); uloz(); kresliSvg(); },
    mapaPng: () => mapaPng().catch(e => Dialog.chyba('PNG se nepodařilo vytvořit: ' + e.message)),
    mapaSvg: async () => stahni(await svgKExportu(), souborNazev() + '-mapa.svg', 'image/svg+xml'),
    tiskni: () => { vykresliTisk(); window.print(); }
  };

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
    hlavicka();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-otevri]');
    if (o) { zavriNabidky(); return otevri(o.dataset.otevri); }
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled && PRIKAZY[b.dataset.prikaz]) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](); }
    // cesta události místo closest: tlačítko, které se po kliknutí překreslí (filtr písem), už v DOM není
    if (!e.composedPath().some(n => n.classList && n.classList.contains('nabidka'))) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    // Zpět/Znovu celé výpravy; v textovém poli nechat vlastní zpět prohlížeče
    const vPoli = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && !vPoli && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); zpet(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); znovu(); }
    }
  });
  $('kroky').addEventListener('click', e => { const b = e.target.closest('[data-krok]'); if (b) prepniKrok(b.dataset.krok); });
  addEventListener('beforeprint', () => { if (data.krok !== 'tisk') prepniKrok('tisk'); });

  window.VYPRAVA_APP = { get vyprava() { return v; }, prepniKrok, otevri, PRIKAZY };
  aplikujVzhled(); novaHistorie();
  hlavicka(); stavKroku(); prepniKrok(KROKY.includes(location.hash.slice(1)) ? location.hash.slice(1) : data.krok);
})();
