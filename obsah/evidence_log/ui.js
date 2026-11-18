/* Evidenční deník důkazů – rozhraní (jádro: evidence_log/jadro.js, test UI: _test/evidence_log_ui.py) */
(function () {
  'use strict';
  const J = window.EvidenceJadro;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dvoj = n => String(n).padStart(2, '0');
  const lokalne = d => `${d.getFullYear()}-${dvoj(d.getMonth() + 1)}-${dvoj(d.getDate())}T${dvoj(d.getHours())}:${dvoj(d.getMinutes())}`;
  const ted = () => lokalne(new Date());
  const velikost = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1).replace('.', ',') + ' kB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
  const kratky = h => J.jeSha256(h) ? h.slice(0, 12) + '…' + h.slice(-6) : esc(h);

  // modelový případ (?pripad=17) má vlastní úložiště – data uživatele zůstanou netknutá
  const MP = window.ModelovyPripad && ModelovyPripad.aktivni ? window.MODELOVY_PRIPAD : null;
  // doslovné názvy klíčů kvůli _test/nastaveni_klice.py
  const KEY_UZIV = 'vysetrovani_evidence', KEY_CASE_UZIV = 'vysetrovani_evidence_case';
  const KEY = MP ? KEY_UZIV + '_pripad' + MP.id : KEY_UZIV;
  const KEY_CASE = MP ? 'vysetrovani_evidence_case_pripad' + MP.id : KEY_CASE_UZIV;

  function nacti() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    if (MP) {
      const odvozene = J.zPripadu(MP);
      if (!Array.isArray(raw)) {
        raw = odvozene;
        localStorage.setItem(KEY_CASE, MP.cislo + ' – ' + MP.nazev);
      } else {
        // starší uložení případu (bez řetězce) doplnit o odvozený druh, stav a předání
        raw = raw.map(x => {
          const o = x && !Array.isArray(x.predani) && odvozene.find(d => d.id === x.id);
          return o ? Object.assign({}, x, { druh: o.druh, stav: o.stav, predani: o.predani }) : x;
        });
      }
    }
    return (Array.isArray(raw) ? raw : []).filter(x => x && typeof x === 'object').map(J.normalizuj);
  }
  let items = nacti();
  let zvyrazneny = null;   // S4: stopa ze skoku ?entita=…
  // se zvoleným spisem (S2) se čte a zapisuje do spisu (entity `stopa`), vlastní úložiště zůstává netknuté
  let N = null;
  const veSpisu = () => !!(N && N.pripad);
  const snimek = new Map();   // id → klíč záznamu, jak byl naposledy ve spisu
  function ulozit() {
    if (veSpisu()) { render(); doSpisu(); return; }
    localStorage.setItem(KEY, JSON.stringify(items)); render();
  }
  function doSpisu() {
    const kopie = items.slice();
    N.zapis(async (S, pripad) => SpisNapojeni.zapisZmeny(snimek, kopie, {
      klic: J.klicZaznamu,
      uloz: async it => { const e = await S.entita(it.id); await S.uloz(Object.assign(J.doSpisu(it, e), { pripad }), { nastroj: 'evidence_log' }); },
      smaz: id => S.smaz(id, { nastroj: 'evidence_log' })
    }));
  }
  if (MP) localStorage.setItem(KEY, JSON.stringify(items));

  $('caseName').value = localStorage.getItem(KEY_CASE) || '';
  $('caseName').addEventListener('input', () => { if (!veSpisu()) localStorage.setItem(KEY_CASE, $('caseName').value); });
  const spis = () => $('caseName').value.trim();

  // výběry druhů, stavů a obalu
  const moznosti = (sel, seznam) => seznam.forEach(([k, n]) => sel.insertAdjacentHTML('beforeend', `<option value="${k}">${esc(n)}</option>`));
  moznosti($('fDruh'), J.DRUHY); moznosti($('sDruh'), J.DRUHY);
  moznosti($('fStav'), J.STAVY); moznosti($('sStav'), J.STAVY);
  moznosti($('pObal'), J.OBALY);

  /* ---------- tabulka ---------- */
  const razeni = { sl: 'time', smer: 1 };
  function zobrazene() {
    return J.seradit(J.filtr(items, { hledat: $('hledat').value, druh: $('fDruh').value, stav: $('fStav').value, jenProblemy: $('fProblemy').checked }), razeni.sl, razeni.smer);
  }
  function znakKontroly(v) {
    if (!v.length) return '<span class="znak ok" title="Řetězec úplný a navazující">✓ v pořádku</span>';
    const chyb = v.filter(x => x.uroven === 'chyba').length;
    return `<span class="znak ${chyb ? 'chyba' : 'pozor'}" title="${esc(v.map(x => x.text).join('\n'))}">${chyb ? '⛔' : '⚠️'} ${v.length}</span>`;
  }
  function znakOtisku(it) {
    if (!it.hash) return '<span class="mala">—</span>';
    const o = it.overeno;
    const z = o ? (o.shoda ? `<span class="znak ok" title="Ověřeno ${esc(J.formatCas(o.kdy))}: ${esc(o.nazev)}">✓ ověřeno</span>` : `<span class="znak chyba" title="Ověření ${esc(J.formatCas(o.kdy))}: ${esc(o.nazev)}">✗ neshoda</span>`) : '';
    return `<span class="otisk" title="${esc(it.hash)}">${kratky(it.hash)}</span> ${z}`;
  }
  function render() {
    const vid = zobrazene(), tdy = ted();
    $('tbody').innerHTML = vid.map(it => {
      const v = J.kontrola(it, tdy);
      return `<tr data-id="${esc(it.id)}"${it.id === zvyrazneny ? ' class="zvyrazneny" aria-current="true"' : ''}>
        <td data-k="Č." class="cislo">${esc(it.num) || '<span class="mala">?</span>'}</td>
        <td data-k="Zajištěno">${esc(J.formatCas(it.time))}</td>
        <td data-k="Druh">${esc(J.nazev(J.DRUHY, it.druh))}</td>
        <td data-k="Popis"><div>${esc(it.desc)}${it.place ? `<div class="mala">📍 ${esc(it.place)}</div>` : ''}</div></td>
        <td data-k="Zajistil">${esc(it.by)}</td>
        <td data-k="Stav">${esc(J.nazev(J.STAVY, it.stav))}</td>
        <td data-k="Umístění">${esc(J.drzitel(it))}</td>
        <td data-k="Otisk"><div>${znakOtisku(it)}</div></td>
        <td data-k="Řetězec"><div><span class="mala">${it.predani.length}× předáno</span> ${znakKontroly(v)}</div></td>
        <td data-k="" class="akce">${veSpisu() ? '<button class="tl mini" data-karta title="Karta ve spisu – kde všude stopa je (fotky, náčrt, osa)">📁</button> ' : ''}<button class="tl mini" data-upravit title="Upravit, řetězec předání">✏️</button> <button class="tl mini" data-stitek title="Štítek">🏷️</button> <button class="tl mini" data-smazat title="Smazat">🗑️</button></td>
      </tr>`;
    }).join('');
    $('empty').hidden = vid.length > 0;
    const probl = items.filter(it => J.kontrola(it, tdy).length).length;
    const dig = items.filter(it => J.jeSha256(it.hash)).length;
    $('souhrn').innerHTML = `<span>Stop: <b>${items.length}</b>${vid.length !== items.length ? ` (zobrazeno <b>${vid.length}</b>)` : ''}</span>
      <span>S otiskem SHA-256: <b>${dig}</b></span><span>S upozorněním: <b>${probl}</b></span>
      <span>Předání celkem: <b>${items.reduce((s, it) => s + it.predani.length, 0)}</b></span>`;
    document.querySelectorAll('th [data-razeni]').forEach(b => {
      b.classList.toggle('akt', b.dataset.razeni === razeni.sl);
      b.textContent = b.textContent.replace(/ [▲▼]$/, '') + (b.dataset.razeni === razeni.sl ? (razeni.smer > 0 ? ' ▲' : ' ▼') : '');
    });
  }
  ['hledat', 'fDruh', 'fStav', 'fProblemy'].forEach(id => $(id).addEventListener('input', render));
  document.querySelectorAll('th [data-razeni]').forEach(b => b.onclick = () => {
    razeni.smer = razeni.sl === b.dataset.razeni ? -razeni.smer : 1; razeni.sl = b.dataset.razeni; render();
  });
  $('tbody').addEventListener('click', async e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const it = items.find(x => x.id === tr.dataset.id);
    if (e.target.closest('[data-karta]')) {
      SpisKarta.otevri(it.id, { nastroj: 'evidence_log', akce: [{ text: '✏️ Upravit v deníku', fn: () => otevriStopu(it.id) }] });
    } else if (e.target.closest('[data-smazat]')) {
      if (await Dialog.potvrd(`Smazat stopu ${it.num || ''} z deníku?`)) { items = items.filter(x => x !== it); ulozit(); }
    } else if (e.target.closest('[data-stitek]')) otevriStitky([it]);
    else otevriStopu(it.id);
  });

  /* ---------- otisk souboru ---------- */
  async function otisk(soubor, prubeh) {
    prubeh.hidden = false; prubeh.value = 0;
    try { return await J.otiskSouboru(soubor, p => { prubeh.value = p; }); }
    finally { prubeh.hidden = true; }
  }
  function zona(el, naSoubor) {
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('nad'); });
    el.addEventListener('dragleave', () => el.classList.remove('nad'));
    el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('nad'); const f = e.dataTransfer.files[0]; if (f) naSoubor(f); });
  }
  const infoSouboru = f => ({ nazev: f.name, velikost: f.size, zmeneno: f.lastModified ? lokalne(new Date(f.lastModified)) : '' });

  /* ---------- dialog stopy ---------- */
  let koncept = null, rezimSouboru = 'otisk', zakladKonceptu = null;   // klíč záznamu při otevření dialogu (změna jinde = střet)
  const POLE = { sNum: 'num', sTime: 'time', sDruh: 'druh', sStav: 'stav', sDesc: 'desc', sPlace: 'place', sBy: 'by', sHandover: 'handover', sNote: 'note', sHash: 'hash' };
  function zKonceptu() { for (const [id, k] of Object.entries(POLE)) koncept[k] = $(id).value; koncept.hash = koncept.hash.trim(); }

  function otevriStopu(id) {
    const it = id && items.find(x => x.id === id);
    koncept = JSON.parse(JSON.stringify(it || J.normalizuj({ time: ted(), num: dalsiCislo(), by: posledniZajistil() })));
    koncept._novy = !it;
    zakladKonceptu = it ? J.klicZaznamu(it) : null;
    for (const [pole, k] of Object.entries(POLE)) $(pole).value = koncept[k] || '';
    $('stopaNadpis').textContent = it ? 'Stopa ' + (it.num || '') : 'Nová stopa';
    $('btnSmazStopu').hidden = !it;
    $('sOvereni').textContent = ''; $('sOvereni').className = 'vysl';
    vykresliRetezec();
    $('dlgStopa').showModal();
  }
  function dalsiCislo() {
    const max = items.reduce((m, it) => Math.max(m, parseInt((/(\d+)\s*$/.exec(it.num) || [0, 0])[1], 10)), 0);
    return 'D-' + dvoj(max + 1);
  }
  const posledniZajistil = () => (items[items.length - 1] || {}).by || '';

  function vykresliRetezec() {
    zKonceptu();
    const s = koncept.soubor;
    $('sSoubor').innerHTML = s ? `📄 <b>${esc(s.nazev)}</b> · ${velikost(s.velikost)}${s.zmeneno ? ' · změněn ' + esc(J.formatCas(s.zmeneno)) : ''}${s.otiskKdy ? ' · otisk spočítán ' + esc(J.formatCas(s.otiskKdy)) : ''}` : '';
    const p = koncept.predani;
    $('sRetezec').innerHTML = `<thead><tr><th>#</th><th>Kdy</th><th>Předal → převzal</th><th>Účel</th><th>Obal</th><th>Pozn.</th><th></th></tr></thead><tbody>
      <tr><td>0</td><td>${esc(J.formatCas(koncept.time))}</td><td>zajištění: <b>${esc(koncept.by)}</b></td><td>zajištění stopy</td><td colspan="2">${esc(koncept.handover)}</td><td></td></tr>
      ${p.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(J.formatCas(x.kdy))}</td><td>${esc(x.od)} → <b>${esc(x.komu)}</b></td><td>${esc(x.ucel)}</td>
        <td>${esc(J.nazev(J.OBALY, x.obal))}</td><td>${esc(x.pozn)}</td><td><button class="tl mini" data-smaz-predani="${i}" title="Odebrat chybný zápis">✕</button></td></tr>`).join('')}</tbody>`;
    const drz = J.drzitel(koncept);
    $('sDrzitel').innerHTML = drz ? 'Aktuálně u: <b>' + esc(drz) + '</b>' : '';
    $('pOd').value = (p.length ? p[p.length - 1].komu : koncept.by) || '';
    $('pKdy').value = ted();
    const v = J.kontrola(koncept, ted());
    $('sKontrola').innerHTML = v.length ? v.map(x => `<li class="${x.uroven}">${esc(x.text)}</li>`).join('') : '<li class="ok">Záznam je úplný a řetězec předání navazuje.</li>';
  }
  ['sTime', 'sBy', 'sDruh', 'sHash', 'sNum', 'sHandover'].forEach(id => $(id).addEventListener('change', vykresliRetezec));
  $('sRetezec').addEventListener('click', async e => {
    const b = e.target.closest('[data-smaz-predani]'); if (!b) return;
    if (await Dialog.potvrd('Odebrat zápis předání č. ' + (+b.dataset.smazPredani + 1) + '? Použijte jen k opravě chybného zápisu.')) {
      koncept.predani.splice(+b.dataset.smazPredani, 1); vykresliRetezec();
    }
  });
  $('btnPredani').onclick = () => {
    const p = { kdy: $('pKdy').value, od: $('pOd').value.trim(), komu: $('pKomu').value.trim(), ucel: $('pUcel').value.trim(), obal: $('pObal').value, pozn: $('pPozn').value.trim() };
    if (!p.komu) { $('pKomu').focus(); Dialog.chyba('Vyplňte, kdo stopu převzal.'); return; }
    koncept.predani.push(p);
    ['pKomu', 'pUcel', 'pPozn'].forEach(id => { $(id).value = ''; }); $('pObal').value = 'neporusen';
    vykresliRetezec();
  };
  $('btnUlozStopu').onclick = async () => {
    zKonceptu();
    if (!koncept.desc.trim() && !koncept.num.trim()) { $('sDesc').focus(); Dialog.chyba('Vyplňte aspoň číslo nebo popis stopy.'); return; }
    if (koncept.hash && !J.jeSha256(koncept.hash)) { $('sHash').focus(); Dialog.chyba('Otisk musí mít 64 hexadecimálních znaků (SHA-256).'); return; }
    // stopu mezitím změnil nebo smazal jiný nástroj / záložka (spis) – nepřepsat potichu cizí změnu (např. předání z Terénu)
    const ted = !koncept._novy && items.find(x => x.id === koncept.id);
    if (!koncept._novy && !ted) {
      if (!(await Dialog.potvrd('Stopa byla mezitím smazána (v jiné záložce nebo jiném nástroji). Uložit váš záznam jako novou stopu?', { ok: 'Uložit jako novou', zrus: 'Zahodit' }))) { $('dlgStopa').close(); return; }
      koncept.id = J.novyId(); koncept._novy = true;
    } else if (ted && J.klicZaznamu(ted) !== zakladKonceptu &&
      !(await Dialog.potvrd('Stopa byla mezitím změněna jinde (jiná záložka, Terén, spis). Uložením se tamty změny přepíšou vaší verzí. Uložit přesto?', { ok: 'Přepsat', zrus: 'Zpět k úpravám' }))) return;
    const novy = koncept._novy; delete koncept._novy;
    if (koncept.overeno && !J.stejnyOtisk(koncept.hash, koncept.overeno.otisk)) delete koncept.overeno;
    const it = J.normalizuj(koncept);
    if (novy) items.push(it); else items[items.findIndex(x => x.id === it.id)] = it;
    $('dlgStopa').close(); ulozit();
    Dialog.info((novy ? 'Stopa zapsána: ' : 'Uloženo: ') + (it.num || it.desc));
  };
  $('btnSmazStopu').onclick = async () => {
    if (!(await Dialog.potvrd('Smazat stopu ' + (koncept.num || '') + ' včetně řetězce předání?'))) return;
    items = items.filter(x => x.id !== koncept.id); $('dlgStopa').close(); ulozit();
  };
  $('btnStitekStopy').onclick = () => { zKonceptu(); const it = J.normalizuj(koncept); $('dlgStopa').close(); otevriStitky([it]); };

  async function souborStopy(f) {
    zKonceptu();
    const rezim = rezimSouboru === 'over' || (rezimSouboru === 'auto' && J.jeSha256(koncept.hash)) ? 'over' : 'otisk';
    rezimSouboru = 'auto';
    if (rezim === 'over' && !J.jeSha256(koncept.hash)) { Dialog.chyba('Stopa zatím nemá platný otisk – nejdřív ho spočítejte.'); return; }
    const h = await otisk(f, $('sPrubeh'));
    if (rezim === 'otisk') {
      if (J.jeSha256(koncept.hash) && !J.stejnyOtisk(koncept.hash, h) &&
        !(await Dialog.potvrd('Stopa už má jiný otisk. Nahradit ho otiskem souboru „' + f.name + '“?'))) return;
      $('sHash').value = h;
      koncept.soubor = Object.assign(infoSouboru(f), { otiskKdy: ted() });
      if (!$('sDruh').value) $('sDruh').value = 'digitalni';
      if (!$('sDesc').value.trim()) $('sDesc').value = f.name;
      $('sOvereni').className = 'vysl'; $('sOvereni').textContent = '';
      vykresliRetezec();
    } else {
      const shoda = J.stejnyOtisk(koncept.hash, h);
      koncept.overeno = { kdy: ted(), shoda, nazev: f.name, otisk: h };
      $('sOvereni').className = 'vysl ' + (shoda ? 'ok' : 'chyba');
      $('sOvereni').innerHTML = shoda ? `✅ <b>Shoda</b> – soubor „${esc(f.name)}“ je bitově totožný s otiskem stopy.`
        : `❌ <b>Neshoda</b> – soubor „${esc(f.name)}“ má otisk <span class="otisk">${h}</span>, stopa <span class="otisk">${esc(koncept.hash)}</span>. Soubor byl změněn, nebo jde o jiný soubor.`;
    }
  }
  $('btnOtisk').onclick = () => { rezimSouboru = 'otisk'; $('souborStopa').click(); };
  $('btnOverStopu').onclick = () => { rezimSouboru = 'over'; $('souborStopa').click(); };
  $('souborStopa').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) souborStopy(f); };
  zona($('zonaStopa'), f => { rezimSouboru = 'auto'; souborStopy(f); });

  /* ---------- ověření souboru proti deníku ---------- */
  async function overSoubor(f) {
    $('oVysl').className = 'vysl'; $('oVysl').textContent = 'Počítám otisk…';
    const h = await otisk(f, $('oPrubeh'));
    const shody = items.filter(it => J.stejnyOtisk(it.hash, h));
    shody.forEach(it => { it.overeno = { kdy: ted(), shoda: true, nazev: f.name, otisk: h }; });
    if (shody.length) ulozit();
    $('oVysl').className = 'vysl ' + (shody.length ? 'ok' : 'chyba');
    $('oVysl').innerHTML = `📄 ${esc(f.name)} · ${velikost(f.size)}<br>SHA-256: <span class="otisk">${h}</span><br>` +
      (shody.length ? '✅ <b>Shoda</b> se stopou ' + shody.map(it => `<b>${esc(it.num)}</b> (${esc(it.desc)})`).join(', ')
        : '❌ <b>Žádná stopa v deníku nemá tento otisk.</b> Soubor mohl být změněn, nebo není zaevidován.');
  }
  $('btnOverit').onclick = () => { $('oVysl').textContent = ''; $('dlgOvereni').showModal(); };
  $('btnVyberOvereni').onclick = () => $('souborOvereni').click();
  $('souborOvereni').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) overSoubor(f); };
  zona($('zonaOvereni'), overSoubor);

  /* ---------- štítky ---------- */
  const FORMATY = { 24: { sl: 3, r: 8, w: 70, h: 37, qr: 27, pad: 0.5 }, 10: { sl: 2, r: 5, w: 105, h: 57, qr: 40, pad: 6 }, 4: { sl: 2, r: 2, w: 105, h: 148.5, qr: 70, pad: 0 } };
  let stitkyPro = [];
  function arch(seznam, format, od) {
    const F = FORMATY[format], naArch = F.sl * F.r;
    const bunky = Array(Math.max(0, Math.min(naArch - 1, (od | 0) - 1))).fill(null).concat(seznam);
    const archy = [];
    for (let i = 0; i < bunky.length; i += naArch) {
      const a = document.createElement('div');
      a.className = 'arch';
      a.style.cssText = `grid-template-columns:repeat(${F.sl},${F.w}mm);grid-auto-rows:${F.h}mm;padding:${F.pad}mm 0;height:297mm;${i + naArch < bunky.length ? 'break-after:page;' : ''}`;
      bunky.slice(i, i + naArch).forEach(it => {
        const s = document.createElement('div');
        s.className = 'stitek' + (it ? '' : ' prazdny');
        if (it) {
          s.style.flexDirection = format === '4' ? 'column' : 'row';
          s.innerHTML = `<div class="tx"><div class="s">${esc(spis() || 'spis neuveden')}</div><div class="c">${esc(it.num || '?')}</div>
            <div class="s">${esc(J.nazev(J.DRUHY, it.druh) || 'druh neurčen')} · ${esc(J.formatCas(it.time))}</div>
            <div class="d">${esc(it.desc)}</div><div class="s">Zajistil: ${esc(it.by)}</div>
            ${J.jeSha256(it.hash) ? `<div class="h">SHA-256: ${esc(it.hash.toLowerCase())}</div>` : ''}</div>
            <div class="qr" style="width:${F.qr}mm"></div>`;
          new QRCode(s.querySelector('.qr'), { text: J.qrText(it, spis()), width: 360, height: 360, correctLevel: QRCode.CorrectLevel.M });
        }
        a.appendChild(s);
      });
      archy.push(a);
    }
    return archy;
  }
  function nahledStitku() {
    const f = $('stFormat').value, na = FORMATY[f].sl * FORMATY[f].r;
    const archy = arch(stitkyPro, f, $('stOd').value);
    const cil = $('stNahled');
    cil.innerHTML = '';
    archy.forEach(a => { a.style.marginBottom = '8px'; cil.appendChild(a); });
    cil.style.zoom = Math.min(1, (cil.parentElement.clientWidth - 20) / (210 * 96 / 25.4)).toFixed(3);
    $('stInfo').textContent = `Štítků: ${stitkyPro.length} · archů A4: ${archy.length} · ${na} na arch. QR obsahuje spis, číslo stopy, ID záznamu a otisk SHA-256.`;
  }
  function otevriStitky(seznam) {
    stitkyPro = seznam || zobrazene();
    if (!stitkyPro.length) { Dialog.chyba('Žádné stopy k tisku – upravte filtr nebo přidejte stopu.'); return; }
    $('dlgStitky').showModal();
    nahledStitku();
  }
  $('stFormat').onchange = nahledStitku; $('stOd').oninput = nahledStitku;
  $('btnStitky').onclick = () => otevriStitky();
  $('btnTiskStitku').onclick = () => {
    $('dlgStitky').close();
    const t = $('tisk'); t.innerHTML = '';
    arch(stitkyPro, $('stFormat').value, $('stOd').value).forEach(a => t.appendChild(a));
    setTimeout(() => window.print(), 300);   // QR obrázky se dokreslí z dataURL
  };

  /* ---------- tisk deníku ---------- */
  function tiskDeniku() {
    const tdy = ted();
    const radky = J.seradit(items, 'time', 1).map(it => {
      const v = J.kontrola(it, tdy);
      return `<tr><td><b>${esc(it.num)}</b></td><td>${esc(J.formatCas(it.time))}</td><td>${esc(J.nazev(J.DRUHY, it.druh))}</td>
        <td>${esc(it.desc)}${it.place ? '<br>Místo: ' + esc(it.place) : ''}${it.handover ? '<br>Obal: ' + esc(it.handover) : ''}${it.note ? '<br>Pozn.: ' + esc(it.note) : ''}</td>
        <td>${esc(it.by)}</td><td>${esc(J.nazev(J.STAVY, it.stav))}<br>U: ${esc(J.drzitel(it))}</td>
        <td class="otisk">${esc(it.hash)}</td></tr>
        <tr><td></td><td colspan="6">${it.predani.length ? '<b>Řetězec předání:</b><ol style="padding-left:16px">' + it.predani.map(p =>
          `<li>${esc(J.formatCas(p.kdy))} – ${esc(p.od)} → ${esc(p.komu)}; účel: ${esc(p.ucel)}; obal: ${esc(J.nazev(J.OBALY, p.obal))}${p.pozn ? '; ' + esc(p.pozn) : ''}</li>`).join('') + '</ol>' : '<i>Bez zapsaného předání.</i>'}
          ${v.length ? '<div>Upozornění: ' + esc(v.map(x => x.text).join('; ')) + '</div>' : ''}</td></tr>`;
    }).join('');
    $('tisk').innerHTML = `<div class="tisk-denik"><h1>Evidenční deník důkazů</h1><p>Spis: <b>${esc(spis() || '—')}</b> · stop: ${items.length} · vytištěno ${esc(J.formatCas(tdy))}</p>
      <table><thead><tr><th>Č.</th><th>Zajištěno</th><th>Druh</th><th>Popis</th><th>Zajistil</th><th>Stav / umístění</th><th>SHA-256</th></tr></thead><tbody>${radky}</tbody></table>
      <p style="margin-top:6mm">Podpis odpovědné osoby: ................................................</p></div>`;
    window.print();
  }
  addEventListener('afterprint', () => { $('tisk').innerHTML = ''; });

  /* ---------- soubor ---------- */
  function stahni(obsah, typ, pripona) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
    a.download = (spis() || 'evidencni_denik').replace(/[^\w\-]+/g, '_') + pripona;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const PRIKAZY = {
    tiskDeniku,
    exportJson: () => stahni(J.exportJson(spis(), items), 'application/json', '.json'),
    exportCsv: () => stahni(J.csv(items), 'text/csv', '.csv'),
    importJson: () => $('fileImport').click(),
    prevodDoSpisu: () => {
      const vlastni = nacti();
      return N.prevod(vlastni.length, `${vlastni.length} stop z vlastního deníku${MP ? ' modelového případu' : ''}`, async (S, pripad) => {
        let nove = 0;
        for (const it of vlastni) {
          const id = SpisNapojeni.bezpecneId(pripad + '.ev.' + it.id);
          if (await S.entita(id)) continue;
          await S.uloz(Object.assign(J.doSpisu(Object.assign({}, it, { id }), null), { pripad }), { nastroj: 'evidence_log' });
          nove++;
        }
        return `Do spisu převedeno ${nove} stop` + (vlastni.length - nove ? `, ${vlastni.length - nove} tam už bylo.` : '.');
      });
    },
    smazatVse: async () => { if (await Dialog.potvrd('Opravdu smazat všechny záznamy evidenčního deníku?')) { items = []; ulozit(); } }
  };
  $('fileImport').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let d;
    try { d = J.importuj(await f.text()); } catch (err) { Dialog.chyba('Neplatný soubor: ' + err.message); return; }
    // ve spisu: id, které ve spisu patří jinému případu, jiné entitě než stopě nebo smazanému záznamu, dostane nové id
    // (jinak by import přepsal cizí data nebo skončil chybou „Záznam patří k jinému případu“)
    if (veSpisu()) for (const it of d.items) {
      const e = SpisNapojeni.platneId(it.id) ? await SPIS.entita(it.id) : { smazano: true };
      if (e && (e.pripad !== N.pripad || e.typ !== 'stopa' || e.smazano)) it.id = J.novyId();
    }
    // ve spisu se jen slučuje – nahrazení by smazalo stopy, které zapsaly jiné nástroje
    const nahradit = !veSpisu() && (!items.length || await Dialog.potvrd(`Soubor obsahuje ${d.items.length} stop. Nahradit jimi současný deník (${items.length} stop)? Jinak se sloučí podle ID.`, { ok: 'Nahradit', zrus: 'Sloučit' }));
    items = nahradit ? d.items : J.slouc(items, d.items);
    if (d.case && !veSpisu() && (nahradit || !spis())) { $('caseName').value = d.case; localStorage.setItem(KEY_CASE, d.case); }
    ulozit();
    Dialog.info('Načteno stop: ' + d.items.length);
  };

  /* ---------- lišta a nabídky ---------- */
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
    if (b) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  document.querySelectorAll('[data-zavrit]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('btnNova').onclick = () => otevriStopu(null);
  $('btnMetoda').onclick = () => $('dlgMetoda').showModal();
  // přetažení souboru na stránku mimo dialog = ověření proti deníku
  addEventListener('dragover', e => { if (!document.querySelector('dialog[open]')) e.preventDefault(); });
  addEventListener('drop', e => {
    if (document.querySelector('dialog[open]') || !e.dataTransfer.files[0]) return;
    e.preventDefault(); $('dlgOvereni').showModal(); overSoubor(e.dataTransfer.files[0]);
  });

  render();

  /* ---------- jednotný spis (S2) ---------- */
  N = SpisNapojeni.pripoj({
    nastroj: 'evidence_log', lista: $('spisMisto'),
    naZmenu: async (pripad, jiny) => {
      J.nastavSpis(!!pripad);
      if (pripad) {
        items = (await SPIS.seznam('stopa', { pripad })).map(J.zeSpisu);
        snimek.clear(); items.forEach(it => snimek.set(it.id, J.klicZaznamu(it)));
        $('caseName').value = N.nazev; $('caseName').readOnly = true;
      } else if (jiny) {
        items = nacti(); snimek.clear();
        $('caseName').value = localStorage.getItem(KEY_CASE) || ''; $('caseName').readOnly = false;
      }
      $('miPrevod').hidden = !pripad;
      $('spisPozn').hidden = !pripad;
      render();
    }
  });
  // S4: skok z karty jiného nástroje – ?entita=<id stopy> řádek zvýrazní a posune do pohledu
  function zvyrazni(id) {
    zvyrazneny = id; render();
    const tr = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (tr) tr.scrollIntoView({ block: 'center' });
  }
  SpisOdkazy.zde('evidence_log', p => zvyrazni(p.entita));
  N.hotovo.then(async () => {
    const c = await SpisOdkazy.cil();
    if (!c) return;
    if (c.prepnuto) await N.obnov();
    zvyrazni(c.e.id);
  });
  window.EVIDENCE_APP = { items: () => items, PRIKAZY, otevriStopu, otevriStitky, render, KEY, get spis() { return N.pripad; }, hotovo: () => N.hotovo, get zvyrazneny() { return zvyrazneny; } };
})();
