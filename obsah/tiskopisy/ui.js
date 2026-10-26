// Tiskopisy – ovládání, editor šablony a sestavení listů. Stránka určí tiskopis atributem <body data-tiskopis="…">.
// Šablona je datový objekt (viz TISK_JADRO.normalizujSablonu): uživatel ji upravuje v editoru, ukládá pod
// vlastním názvem a přenáší jako JSON. Listy jsou v mm; řádky se přidávají, dokud se tabulka vejde.
(function () {
  'use strict';
  const J = window.TISK_JADRO;
  const ID = document.body.dataset.tiskopis;
  const D = window.TISKOPISY[ID];
  const KLIC = 'webapp_tiskopisy_' + ID;
  const KLIC_VLASTNI = 'webapp_tiskopisy_' + ID + '_sablony';
  const KLIC_ORG = 'webapp_tiskopisy_organizace';
  const ORG_POLE = [
    { id: 'nazev', popisek: 'Zaměstnavatel / organizace' },
    { id: 'ico', popisek: 'IČO' },
    { id: 'adresa', popisek: 'Sídlo (adresa)' },
    { id: 'provozovna', popisek: 'Provozovna / pracoviště' },
  ];
  const SIRKY = [[0, 'auto'], [25, '¼'], [33, '⅓'], [50, '½'], [67, '⅔'], [100, 'celá']];

  const esc = J.escHtml;
  const kopie = o => JSON.parse(JSON.stringify(o));
  const nacti = (k, vychozi) => { try { return JSON.parse(localStorage.getItem(k)) ?? vychozi; } catch { return vychozi; } };
  const uloz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { Dialog.chyba('Úložiště prohlížeče je plné – změny se neuloží.'); } };
  const prazdne = s => !String(s ?? '').trim();
  const dnes = new Date();
  const TENTO_MESIC = `${dnes.getFullYear()}-${String(dnes.getMonth() + 1).padStart(2, '0')}`;

  // ---------- stav ----------
  const VZORY = Object.keys(D.vzory);
  const org = nacti(KLIC_ORG, {});
  let vlastni = (Array.isArray(nacti(KLIC_VLASTNI, [])) ? nacti(KLIC_VLASTNI, []) : []).filter(v => v && v.id && v.sab);
  const ulozeny = nacti(KLIC, {}) || {};
  const stav = {
    vzor: ulozeny.vzor || VZORY[0],                 // klíč vestavěného vzoru nebo 'u:<id>' vlastní šablony
    sab: null,                                      // pracovní kopie šablony (to, co se tiskne)
    hodnoty: ulozeny.hodnoty && typeof ulozeny.hodnoty === 'object' ? ulozeny.hodnoty : {},
    seznam: String(ulozeny.seznam || ''),
    mesic: ulozeny.mesic || TENTO_MESIC,
  };
  const zdrojSablony = klic => klic.startsWith('u:') ? vlastni.find(v => 'u:' + v.id === klic)?.sab : D.vzory[klic];
  if (!zdrojSablony(stav.vzor)) stav.vzor = VZORY[0];
  stav.sab = J.normalizujSablonu(ulozeny.sab || zdrojSablony(stav.vzor));
  const upraveno = () => JSON.stringify(stav.sab) !== JSON.stringify(J.normalizujSablonu(zdrojSablony(stav.vzor)));
  const vychoziHodnoty = sab => sab.udaje.forEach(u => { if (u.vychozi && !(u.id in stav.hodnoty)) stav.hodnoty[u.id] = u.vychozi; });
  vychoziHodnoty(stav.sab);

  // ---------- kostra stránky ----------
  document.body.insertAdjacentHTML('afterbegin', `
<header class="lista">
  <div class="skup skup-projekt"><h1 id="nadpis"></h1><span class="pocet" id="pocet"></span></div>
  <div class="skup" role="group" aria-label="Šablona"><span class="skup-nazev" aria-hidden="true">Šablona</span><div class="skup-tl">
    <select class="tl" id="vyberVzoru" aria-label="Vzor tiskopisu" title="Vestavěné vzory a vaše uložené šablony"></select>
    <button class="tl" id="btnEditor" aria-pressed="false" title="Upravit název, údaje, sloupce, řádky a texty šablony">✏️<span class="txt"> Upravit šablonu</span></button>
  </div></div>
  <div class="skup" role="group" aria-label="Vyplnit"><span class="skup-nazev" aria-hidden="true">Vyplnit</span><div class="skup-tl">
    <button class="tl" data-nabidka="nabUdaje" aria-expanded="false" title="Organizace a údaje v záhlaví">📝<span class="txt"> Údaje</span> ▾</button>
    <button class="tl" data-nabidka="nabRozvrzeni" aria-expanded="false" title="Orientace, řádky, počet listů">📐<span class="txt"> Rozvržení</span> ▾</button>
  </div></div>
  <div class="skup" role="group" aria-label="Tisk"><span class="skup-nazev" aria-hidden="true">Tisk</span><div class="skup-tl">
    <button class="tl hlavni-tl" id="btnTisk" title="Vytisknout nebo uložit jako PDF (Ctrl+P)">🖨️<span class="txt"> Tisk / PDF</span></button>
  </div></div>
  <span class="vpravo"><button class="tl" id="btnInfo" aria-pressed="false" title="Co musí tiskopis obsahovat a jak ho vést">📖<span class="txt"> Jak to funguje</span></button></span>
</header>
<div id="nabUdaje" class="nabidka" hidden></div>
<div id="nabRozvrzeni" class="nabidka" hidden></div>
<div class="plocha">
  <main class="prostor" id="prostor">
    <section class="info" id="info" hidden></section>
    <div class="listy" id="listy"></div>
  </main>
  <aside class="editor" id="editor" hidden aria-label="Editor šablony"></aside>
</div>
<input type="file" id="souborImport" accept="application/json,.json" hidden>
<style id="stylStranky"></style>`);
  if (window.self === window.top) document.body.classList.add('samostatne');
  const $ = id => document.getElementById(id);

  function ulozStav() {
    uloz(KLIC_ORG, org);
    uloz(KLIC, { vzor: stav.vzor, sab: stav.sab, hodnoty: stav.hodnoty, seznam: stav.seznam, mesic: stav.mesic });
  }
  let casovac = 0;
  function zmena() {
    ulozStav();
    clearTimeout(casovac);
    casovac = setTimeout(vykresli, 200);
  }

  // ---------- výběr vzoru ----------
  function naplnVyber() {
    $('vyberVzoru').innerHTML =
      '<optgroup label="Vzory">' + VZORY.map(k => `<option value="${k}">${esc(D.vzory[k].nazev)}</option>`).join('') + '</optgroup>' +
      (vlastni.length ? '<optgroup label="Moje šablony">' + vlastni.map(v => `<option value="u:${esc(v.id)}">${esc(v.nazev)}</option>`).join('') + '</optgroup>' : '');
    $('vyberVzoru').value = stav.vzor;
    $('vyberVzoru').hidden = VZORY.length + vlastni.length < 2;
  }
  async function prepniVzor(klic) {
    if (upraveno() && !await Dialog.potvrd('Šablona má neuložené úpravy. Přepnout a úpravy zahodit?', { ok: 'Přepnout' })) {
      $('vyberVzoru').value = stav.vzor; return;
    }
    stav.vzor = klic;
    stav.sab = J.normalizujSablonu(zdrojSablony(klic));
    vychoziHodnoty(stav.sab);
    poZmeneSablony();
  }
  $('vyberVzoru').addEventListener('change', e => prepniVzor(e.target.value));

  // ---------- nabídka Údaje ----------
  const vstup = (popisek, hodnota, atr, typ, radku) => `<label>${esc(popisek)}${typ === 'textarea' || radku > 1
    ? `<textarea ${atr} aria-label="${esc(popisek)}">${esc(hodnota)}</textarea>`
    : `<input type="${typ || 'text'}" ${atr} aria-label="${esc(popisek)}" value="${esc(hodnota)}">`}</label>`;
  function naplnUdaje() {
    const s = stav.sab;
    const udaje = s.udaje.filter(u => !u.vypocet && u.typ !== 'zlom');
    $('nabUdaje').innerHTML =
      '<div class="titulek">Organizace (společné pro všechny tiskopisy)</div>' +
      ORG_POLE.map(p => vstup(p.popisek, org[p.id] || '', `data-org="${p.id}"`)).join('') +
      (s.mesic ? '<hr>' + vstup('Měsíc', stav.mesic, 'data-stav="mesic"', 'month') : '') +
      (s.seznam ? vstup(s.seznam.popisek || 'Seznam – jeden na řádek', stav.seznam, 'data-stav="seznam"', 'textarea') : '') +
      (udaje.length ? '<hr><div class="titulek">Údaje v záhlaví</div>' + udaje.map(u => u.typ === 'nadpis'
        ? `<div class="titulek">${esc(u.popisek)}</div>`
        : vstup(u.popisek || '(bez popisku)', stav.hodnoty[u.id] || '', `data-hodnota="${u.id}"`, u.typ === 'date' ? 'date' : '', u.radku)).join('') : '') +
      '<p class="pozn">Prázdná pole se vytisknou jako linka k ručnímu vyplnění. Další údaje přidáte v ✏️ Upravit šablonu.</p>';
  }

  // ---------- nabídka Rozvržení (zapisuje do šablony) ----------
  function naplnRozvrzeni() {
    const s = stav.sab, tab = s.rezim === 'tabulka';
    $('nabRozvrzeni').innerHTML = `
      <div class="radek2">
        <label>Orientace<select data-sab="orientace"><option value="na_vysku">A4 na výšku</option><option value="na_sirku">A4 na šířku</option></select></label>
        <label>Výška řádku (mm)<input type="number" data-sab="vyskaRadku" min="4" max="60" step="0.5" value="${s.vyskaRadku}"></label>
      </div>
      <div class="radek2">
        <label>Počet listů (nejméně)<input type="number" data-sab="stran" min="1" max="200" value="${s.stran}"></label>
        ${tab ? `<label>Řádků celkem (nejméně)<input type="number" data-sab="minRadku" min="0" max="2000" value="${s.minRadku}"></label>`
              : `<label>Kopií na list<input type="number" data-sab="kopii" min="1" max="4" value="${s.kopii}"></label>`}
      </div>
      <label class="zaskrt"><input type="checkbox" data-sab="titulni"${s.titulni ? ' checked' : ''}> Titulní list (kniha)</label>
      <label class="zaskrt"><input type="checkbox" data-sab="pouceni"${s.pouceni ? ' checked' : ''}> List s pokyny</label>
      ${s.sloupce.some(c => c.cislo) ? `<label class="zaskrt"><input type="checkbox" data-sab="cislovat"${s.cislovat ? ' checked' : ''}> Předčíslovat řádky</label>` : ''}
      ${s.sloupce.length ? '<div class="titulek">Tisknout sloupce</div>' + s.sloupce.map((c, i) =>
        `<label class="zaskrt"><input type="checkbox" data-sloupec-tisk="${i}"${c.skryty ? '' : ' checked'}> ${esc(c.nazev || '(bez názvu)')}</label>`).join('') : ''}`;
    $('nabRozvrzeni').querySelector('[data-sab="orientace"]').value = s.orientace;
  }

  // ---------- editor šablony ----------
  const tl = (akce, text, titul, data = '') => `<button type="button" class="tl ik" data-akce="${akce}" ${data} title="${titul}" aria-label="${titul}">${text}</button>`;
  const posuny = (seznam, i, n) =>
    tl('nahoru', '↑', 'Posunout výš', `data-seznam="${seznam}" data-i="${i}"${i ? '' : ' disabled'}`) +
    tl('dolu', '↓', 'Posunout níž', `data-seznam="${seznam}" data-i="${i}"${i < n - 1 ? '' : ' disabled'}`) +
    tl('smaz', '✕', 'Odebrat', `data-seznam="${seznam}" data-i="${i}"`);

  function naplnEditor() {
    const s = stav.sab, tab = s.rezim === 'tabulka';
    const udajRadek = (u, i) => {
      const typ = `<select data-pol="udaje" data-i="${i}" data-k="typ" aria-label="Typ údaje">
          ${[['', 'text'], ['date', 'datum'], ['nadpis', 'mezititulek'], ['zlom', 'nový list']].map(([v, t]) => `<option value="${v}"${u.typ === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
      const sirka = `<select data-pol="udaje" data-i="${i}" data-k="sirka" aria-label="Šířka" title="Šířka v řádku">
          ${SIRKY.map(([v, t]) => `<option value="${v}"${u.sirka === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
      const text = !u.typ || u.typ === 'date';
      return `<div class="ed-radek ed-udaj">
        <input data-pol="udaje" data-i="${i}" data-k="popisek" value="${esc(u.popisek)}" aria-label="Popisek údaje" placeholder="${u.typ === 'zlom' ? '— nový list —' : 'Popisek'}"${u.typ === 'zlom' ? ' disabled' : ''}>
        ${typ}${text ? sirka : ''}
        ${text ? `<input type="number" class="maly" min="1" max="20" data-pol="udaje" data-i="${i}" data-k="radku" value="${u.radku}" title="Počet řádků k vyplnění" aria-label="Počet řádků">` : ''}
        ${u.vypocet ? '<span class="znacka" title="Hodnotu doplní stránka (měsíc, fond, zaměstnanec…)">∑</span>' : ''}
        ${posuny('udaje', i, s.udaje.length)}</div>`;
    };
    const sloupecRadek = (c, i) => `<div class="ed-radek">
        <input type="checkbox" data-pol="sloupce" data-i="${i}" data-k="tisk"${c.skryty ? '' : ' checked'} title="Tisknout sloupec" aria-label="Tisknout sloupec">
        <input data-pol="sloupce" data-i="${i}" data-k="nazev" value="${esc(c.nazev)}" aria-label="Název sloupce" placeholder="${c.cislo ? 'Poř. č.' : 'Název sloupce'}">
        <input type="number" class="maly" min="1" max="200" data-pol="sloupce" data-i="${i}" data-k="sirka" value="${c.sirka}" title="Poměrná šířka" aria-label="Poměrná šířka">
        ${posuny('sloupce', i, s.sloupce.length)}</div>`;

    $('editor').innerHTML = `
      <div class="ed-hlava"><h2>✏️ Šablona</h2>${tl('zavrit', '✕', 'Zavřít editor')}</div>
      <div class="ed-akce">
        <button type="button" class="tl hlavni-tl" data-akce="ulozitJako">💾 Uložit jako…</button>
        ${stav.vzor.startsWith('u:') ? '<button type="button" class="tl" data-akce="prepsat">Přepsat moji</button><button type="button" class="tl" data-akce="smazatVlastni">🗑 Smazat moji</button>' : ''}
        <button type="button" class="tl" data-akce="vratit"${upraveno() ? '' : ' disabled'}>↺ Vrátit úpravy</button>
        <button type="button" class="tl" data-akce="export">⬇ Export JSON</button>
        <button type="button" class="tl" data-akce="import">⬆ Import JSON</button>
      </div>
      <details open><summary>Základ</summary>
        <label>Název tiskopisu<input data-ed="nazev" value="${esc(s.nazev)}"></label>
        <label>Pata listu (předpis, poznámka)<input data-ed="predpis" value="${esc(s.predpis)}"></label>
      </details>
      <details open><summary>Údaje v záhlaví (${s.udaje.length})</summary>
        <p class="pozn">Každý údaj se vytiskne jako „Popisek: hodnota“, nevyplněný jako linka. Mezititulek člení dlouhý formulář, „nový list“ ho rozdělí na víc stran. ∑ = hodnotu doplní stránka.</p>
        ${s.udaje.map(udajRadek).join('')}
        <button type="button" class="tl" data-akce="pridejUdaj">➕ Přidat údaj</button>
      </details>
      <details${tab || s.sloupce.length ? ' open' : ''}><summary>Sloupce tabulky (${s.sloupce.length})</summary>
        <p class="pozn">Šířky jsou poměrné – součet se roztáhne na šířku listu.${s.mesic?.sloupce ? ' Za ně se doplní sloupce pro dny měsíce.' : ''}</p>
        ${s.sloupce.map(sloupecRadek).join('')}
        <div class="ed-akce"><button type="button" class="tl" data-akce="pridejSloupec">➕ Přidat sloupec</button>
        ${s.sloupce.some(c => c.cislo) ? '' : '<button type="button" class="tl" data-akce="pridejCislo">➕ Sloupec pořadí</button>'}</div>
        <label>Součtový řádek (popisek, prázdné = bez součtu)<input data-ed="soucet" value="${esc(s.soucet)}"></label>
      </details>
      <details${s.predvyplnene ? ' open' : ''}><summary>Předtištěné řádky</summary>
        <p class="pozn">Jeden řádek textu = jeden řádek tabulky. Buňky oddělte znakem <b>|</b>, <b># Nadpis</b> vloží mezititulek. Zbytek listu se doplní prázdnými řádky.</p>
        <textarea data-ed="predvyplnene" rows="8" spellcheck="false">${esc(s.predvyplnene)}</textarea>
      </details>
      <details${s.zaver || s.podpisy.length ? ' open' : ''}><summary>Závěr a podpisy</summary>
        <label>Text pod tabulkou (prohlášení, legenda)<textarea data-ed="zaver" rows="3">${esc(s.zaver)}</textarea></label>
        <label>Podpisová pole – jedno na řádek<textarea data-ed-radky="podpisy" rows="3">${esc(s.podpisy.join('\n'))}</textarea></label>
      </details>
      <details><summary>Titulní list a pokyny</summary>
        <label class="zaskrt"><input type="checkbox" data-ed="titulni"${s.titulni ? ' checked' : ''}> Tisknout titulní list</label>
        <label>Řádky titulního listu – jeden na řádek<textarea data-ed-radky="titulniRadky" rows="4">${esc(s.titulniRadky.join('\n'))}</textarea></label>
        <label class="zaskrt"><input type="checkbox" data-ed="pouceni"${s.pouceni ? ' checked' : ''}> Tisknout list s pokyny</label>
        <label>Text pokynů<textarea data-ed="pouceniText" rows="8" spellcheck="false">${esc(s.pouceniText)}</textarea></label>
        <p class="pozn"><b># </b>nadpis, <b>## </b>podnadpis, <b>- </b>odrážka, <b>a | text</b> řádek tabulky, <b>**tučně**</b>, prázdný řádek = nový odstavec.</p>
      </details>`;
  }

  const SEZNAMY = { udaje: () => stav.sab.udaje, sloupce: () => stav.sab.sloupce };
  const noveId = pref => pref + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  async function akceEditoru(akce, el) {
    const s = stav.sab, seznam = el.dataset.seznam && SEZNAMY[el.dataset.seznam](), i = +el.dataset.i;
    switch (akce) {
      case 'zavrit': return prepniEditor(false);
      case 'nahoru': case 'dolu': {
        const j = akce === 'nahoru' ? i - 1 : i + 1;
        if (j < 0 || j >= seznam.length) return;
        [seznam[i], seznam[j]] = [seznam[j], seznam[i]];
        break;
      }
      case 'smaz': seznam.splice(i, 1); break;
      case 'pridejUdaj': s.udaje.push({ id: noveId('u'), popisek: 'Nový údaj', sirka: 0, typ: '', radku: 1, vypocet: false, vychozi: '' }); break;
      case 'pridejSloupec': s.sloupce.push({ id: noveId('s'), nazev: 'Nový sloupec', sirka: 15, znak: '', cislo: false, skryty: false }); break;
      case 'pridejCislo': s.sloupce.unshift({ id: noveId('c'), nazev: 'Č.', sirka: 6, znak: '', cislo: true, skryty: false }); s.cislovat = true; break;
      case 'vratit':
        if (!await Dialog.potvrd('Zahodit úpravy a vrátit šablonu do uloženého stavu?', { ok: 'Vrátit' })) return;
        stav.sab = J.normalizujSablonu(zdrojSablony(stav.vzor));
        break;
      case 'ulozitJako': {
        const nazev = await Dialog.zeptej('Název vlastní šablony', s.nazev, { ok: 'Uložit' });
        if (!nazev?.trim()) return;
        const z = { id: noveId(''), nazev: nazev.trim(), sab: kopie(s) };
        vlastni.push(z);
        uloz(KLIC_VLASTNI, vlastni);
        stav.vzor = 'u:' + z.id;
        Dialog.info('Uloženo do „Moje šablony“');
        break;
      }
      case 'prepsat': {
        const z = vlastni.find(v => 'u:' + v.id === stav.vzor);
        if (!z || !await Dialog.potvrd(`Přepsat šablonu „${z.nazev}“ současnou podobou?`, { ok: 'Přepsat' })) return;
        z.sab = kopie(s);
        uloz(KLIC_VLASTNI, vlastni);
        Dialog.info('Přepsáno');
        break;
      }
      case 'smazatVlastni': {
        const z = vlastni.find(v => 'u:' + v.id === stav.vzor);
        if (!z || !await Dialog.potvrd(`Smazat šablonu „${z.nazev}“?`, { ok: 'Smazat' })) return;
        vlastni = vlastni.filter(v => v !== z);
        uloz(KLIC_VLASTNI, vlastni);
        stav.vzor = VZORY[0];                     // pracovní kopie zůstává – jde znovu uložit
        break;
      }
      case 'export': {
        const data = JSON.stringify({ typ: 'tiskopis-sablona', verze: 1, tiskopis: ID, sablona: s }, null, 2);
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(new Blob([data], { type: 'application/json' })),
          download: (s.nazev.replace(/[^\p{L}\p{N}]+/gu, '_') || 'sablona') + '.json',
        });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return;
      }
      case 'import': $('souborImport').value = ''; $('souborImport').click(); return;
      default: return;
    }
    stav.sab = J.normalizujSablonu(stav.sab);
    poZmeneSablony();
  }

  function importuj(text) {
    const data = JSON.parse(text);
    if (data?.typ !== 'tiskopis-sablona' || !data.sablona) throw new Error('soubor neobsahuje šablonu tiskopisu');
    stav.sab = J.normalizujSablonu(data.sablona);
    vychoziHodnoty(stav.sab);
    poZmeneSablony();
  }
  $('souborImport').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      importuj(await f.text());
      Dialog.info(`Načteno: ${stav.sab.nazev} – uložte přes „Uložit jako…“`);
    } catch (chyba) {
      Dialog.chyba('Šablonu se nepodařilo načíst: ' + chyba.message);
    }
  });

  function prepniEditor(zobrazit) {
    $('editor').hidden = !zobrazit;
    $('btnEditor').setAttribute('aria-pressed', String(zobrazit));
    if (zobrazit) naplnEditor();
    prizpusobMeritko();
  }
  $('btnEditor').addEventListener('click', () => prepniEditor($('editor').hidden));

  // překreslení ovládání po strukturální změně šablony
  function poZmeneSablony() {
    naplnVyber();
    if (!$('editor').hidden) naplnEditor();
    zavriNabidky();
    zmena();
  }

  // ---------- vstupy ----------
  function nastavPolozku(el) {
    const ds = el.dataset, s = stav.sab;
    const cislo = () => { const n = parseFloat(el.value); return n >= 0 ? n : null; };
    if (ds.org) org[ds.org] = el.value;
    else if (ds.stav) stav[ds.stav] = el.value;
    else if (ds.hodnota) stav.hodnoty[ds.hodnota] = el.value;
    else if (ds.sab) {
      if (el.type === 'checkbox') s[ds.sab] = el.checked;
      else if (el.type === 'number') { if (cislo() === null) return false; s[ds.sab] = cislo(); }
      else s[ds.sab] = el.value;
      stav.sab = J.normalizujSablonu(s);
    } else if (ds.sloupecTisk) s.sloupce[+ds.sloupecTisk].skryty = !el.checked;
    else if (ds.ed) s[ds.ed] = el.type === 'checkbox' ? el.checked : el.value;
    else if (ds.edRadky) s[ds.edRadky] = J.radkyTextu(el.value);
    else if (ds.pol) {
      const pol = SEZNAMY[ds.pol]()[+ds.i];
      if (ds.k === 'tisk') pol.skryty = !el.checked;
      else if (el.type === 'number' || ds.k === 'sirka') { if (cislo() === null) return false; pol[ds.k] = cislo(); }
      else pol[ds.k] = el.value;
      if (ds.k === 'typ') { poZmeneSablony(); return false; }   // jiný typ údaje = jiné ovládání v editoru
    } else return false;
    return true;
  }
  document.addEventListener('input', e => {
    if (!nastavPolozku(e.target)) return;
    const v = $('editor').querySelector('[data-akce="vratit"]');
    if (v) v.disabled = !upraveno();
    zmena();
  });
  $('editor').addEventListener('click', e => { const b = e.target.closest('[data-akce]'); if (b && !b.disabled) akceEditoru(b.dataset.akce, b); });
  $('btnTisk').addEventListener('click', () => window.print());
  $('btnInfo').addEventListener('click', e => {
    const skryt = !$('info').hidden;
    $('info').hidden = skryt;
    e.currentTarget.setAttribute('aria-pressed', String(!skryt));
  });

  // nabídky lišty (stejné chování jako prompty.html); obsah se plní při otevření
  const PLNENI = { nabUdaje: naplnUdaje, nabRozvrzeni: naplnRozvrzeni };
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    PLNENI[n.id]();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) zavriNabidky(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });

  // ---------- sestavení listů ----------
  const orgHtml = () => [org.nazev, [org.ico && 'IČO ' + org.ico, org.adresa].filter(Boolean).join(', '), org.provozovna]
    .filter(s => !prazdne(s)).map(esc).join('<br>');

  function udajeHtml(udaje, hodnota) {
    return udaje.map(u => {
      if (u.typ === 'nadpis') return `<div class="udaj-nadpis">${esc(u.popisek)}</div>`;
      let v = hodnota(u);
      if (u.typ === 'date') v = J.datumCesky(v);
      const styl = u.sirka ? ` style="flex:0 0 calc(${u.sirka}% - 6mm)"` : '';
      const vyska = u.radku > 1 ? ` style="min-height:${u.radku * 5}mm"` : '';
      return `<div class="udaj${u.radku > 1 ? ' viceradkovy' : ''}"${styl}>${u.popisek ? `<b>${esc(u.popisek)}:</b>` : ''}<span${vyska}>${esc(v)}</span></div>`;
    }).join('');
  }
  const podpisyHtml = p => p.length ? '<div class="podpisy">' + p.map(k => `<div>${esc(k)}</div>`).join('') + '</div>' : '';

  // Obsah jednoho bloku (u tabulky celý list, u dokladu jedna kopie)
  function blok(rodic, s, udaje, oddil, sloupce, sirky, sZaverem) {
    const el = document.createElement('div');
    el.className = 'blok';
    const hlavicky = sloupce.map(c => `<th${c.vikend ? ' class="vikend"' : ''}>${esc(c.nazev)}${c.pod ? `<sup>${esc(c.pod)}</sup>` : c.znak ? `<sup>${esc(c.znak)})</sup>` : ''}</th>`).join('');
    const soucet = s.soucet && sloupce.length > 1 ? `<tfoot><tr style="height:${s.vyskaRadku}mm"><td colspan="2">${esc(s.soucet)}</td>${'<td></td>'.repeat(sloupce.length - 2)}</tr></tfoot>` : '';
    const tabulka = sloupce.length ? `<table class="tab"><colgroup>${sirky.map(w => `<col style="width:${w}mm">`).join('')}</colgroup>
        <thead><tr>${hlavicky}</tr></thead><tbody></tbody>${soucet}</table>` : '';
    const udajeObsah = udajeHtml(udaje, u => oddil.hodnoty[u.id]);
    el.innerHTML = `
      <div class="hlava"><h2>${esc(s.nazev)}</h2><div class="org">${orgHtml()}</div></div>
      ${udajeObsah ? `<div class="udaje">${udajeObsah}</div>` : ''}
      <div class="telo">${tabulka}${sZaverem ? (s.zaver ? `<p class="prohlaseni">${esc(s.zaver)}</p>` : '') + podpisyHtml(s.podpisy) : ''}</div>
      <div class="pata"><span>${esc(s.predpis)}</span><span class="cislo-strany"></span></div>`;
    rodic.appendChild(el);
    return el;
  }

  const pretika = el => { const t = el.querySelector('.telo'); return t.scrollHeight > t.clientHeight + 1; };

  function radekEl(sloupce, data, poradi, cislovat, vyska) {
    const tr = document.createElement('tr');
    tr.style.height = vyska + 'mm';
    if (data._oddil != null) {
      tr.className = 'oddil';
      tr.innerHTML = `<td colspan="${sloupce.length}">${esc(data._oddil)}</td>`;
      return tr;
    }
    if (data._trida) tr.className = data._trida;
    if (data._titulek) tr.title = data._titulek;
    tr.innerHTML = sloupce.map(c => c.cislo
      ? `<td class="cislo">${cislovat ? poradi : ''}</td>`
      : `<td${c.vikend ? ' class="vikend"' : ''}>${esc(data[c.id])}</td>`).join('');
    return tr;
  }

  // Naplní tabulku bloku řádky od indexu `i` (a případně prázdnými do konce); vrátí nový stav.
  function naplnBlok(el, s, sloupce, radky, i, poradi, doplnit) {
    const tbody = el.querySelector('tbody');
    if (!tbody) return { i: radky.length, poradi };
    let naBloku = 0;
    const pridej = data => {
      const tr = radekEl(sloupce, data, poradi + 1, s.cislovat, s.vyskaRadku);
      tbody.appendChild(tr);
      if (pretika(el) && naBloku > 0) { tr.remove(); return false; }
      if (data._oddil == null) poradi++;
      naBloku++;
      return true;
    };
    while (i < radky.length && pridej(radky[i])) i++;
    if (i >= radky.length && doplnit) while (naBloku < 400 && pridej({}));
    return { i, poradi };
  }

  function novyList(trida) {
    const el = document.createElement('div');
    el.className = `list ${stav.sab.orientace} ${trida}`;
    $('listy').appendChild(el);
    return el;
  }

  // Oddíly k tisku: jeden, nebo jeden na osobu ze seznamu (každý začíná na novém listu).
  function oddily(s) {
    const vypocet = Object.assign({}, D.hodnoty ? D.hodnoty(stav, J, s) : {}, s.mesic ? { mesic: J.nazevMesice(stav.mesic) } : {});
    const zakladni = {};
    s.udaje.forEach(u => { zakladni[u.id] = !prazdne(stav.hodnoty[u.id]) ? stav.hodnoty[u.id] : (vypocet[u.id] ?? ''); });
    const ciste = s.sloupce.filter(c => !c.cislo).map(c => c.id);
    const jmena = J.radkyTextu(stav.seznam);
    const radky = [];
    if (s.seznam?.doSloupce) radky.push(...jmena.map(j => ({ [s.seznam.doSloupce]: j })));
    if (s.mesic?.radky) radky.push(...J.dnyMesice(stav.mesic).map(d => ({
      [s.mesic.radky]: `${d.den}. ${d.zkratka}`,
      ...(d.svatek && s.mesic.svatekDo ? { [s.mesic.svatekDo]: 'S – svátek' } : {}),
      _trida: d.svatek ? 'svatek' : d.vikend ? 'vikend' : '', _titulek: d.svatek,
    })));
    radky.push(...J.parsujRadky(s.predvyplnene, ciste));
    if (s.seznam?.naOsobu) return (jmena.length ? jmena : ['']).map(j => ({ hodnoty: Object.assign({}, zakladni, { [s.seznam.naOsobu]: j }), radky }));
    return [{ hodnoty: zakladni, radky }];
  }

  function rozlozTabulku(s, oddil, sloupce, sirky) {
    const listy = [];
    let i = 0, poradi = 0;
    const udaje = s.udaje.filter(u => u.typ !== 'zlom');
    while (listy.length < 500) {
      const list = novyList('tabulkovy');
      const el = blok(list, s, udaje, oddil, sloupce, sirky, true);
      ({ i, poradi } = naplnBlok(el, s, sloupce, oddil.radky, i, poradi, !s.bezDoplneni));
      listy.push(list);
      if (i >= oddil.radky.length && (s.bezDoplneni || (listy.length >= s.stran && poradi >= s.minRadku))) break;
    }
    return listy;
  }

  // Doklad: údaje rozdělené „novým listem“ na části; na listu `kopii` stejných kopií pod sebou.
  function rozlozDoklad(s, oddil, sloupce, sirky) {
    const casti = [[]];
    s.udaje.forEach(u => (u.typ === 'zlom' ? casti.push([]) : casti[casti.length - 1].push(u)));
    const listy = [];
    for (let opak = 0; opak < s.stran; opak++) {
      casti.forEach((udaje, ci) => {
        const posledni = ci === casti.length - 1;
        const list = novyList('doklad' + (s.kopii > 1 ? ' kopie' : ''));
        for (let k = 0; k < s.kopii; k++) {
          const el = blok(list, s, udaje, oddil, posledni ? sloupce : [], sirky, posledni);
          if (posledni) naplnBlok(el, s, sloupce, oddil.radky, 0, 0, !s.bezDoplneni);
        }
        listy.push(list);
      });
    }
    return listy;
  }

  function titulniList(s, pocetStran) {
    const list = novyList('titulni');
    const radek = (p, v) => `<div class="udaj"><b>${esc(p)}:</b><span>${esc(v)}</span></div>`;
    list.innerHTML = `
      <div class="stred">
        <h2>${esc(s.nazev)}</h2>
        <div class="podnadpis">${esc(s.predpis)}</div>
        <div class="orgblok">
          ${radek('Organizace', org.nazev)}${radek('IČO', org.ico)}${radek('Sídlo', org.adresa)}${radek('Provozovna', org.provozovna)}
          ${s.titulniRadky.map(t => radek(t, '')).join('')}
          ${radek('Počet očíslovaných stran', String(pocetStran))}
        </div>
      </div>
      <div class="razitko">razítko a podpis</div>`;
    return list;
  }

  function vykresli() {
    const s = stav.sab, listy = $('listy');
    $('nadpis').textContent = '🖨️ ' + s.nazev;
    $('info').innerHTML = D.info + (s.predpis ? `<p class="predpis">Podklad: ${esc(s.predpis)}.</p>` : '') +
      '<p class="predpis">Tiskopis je vzor – za soulad s aktuálními předpisy odpovídá uživatel. Šablonu můžete upravit (✏️) a uložit pod vlastním názvem.</p>';
    listy.innerHTML = '';
    listy.style.setProperty('--zoom', 1);              // měřit vždy v měřítku 1:1
    const sirkaMm = (s.orientace === 'na_sirku' ? 297 : 210) - 20;
    const sloupce = s.sloupce.filter(c => !c.skryty).concat(s.mesic?.sloupce ? J.sloupceDnu(stav.mesic, s.mesic.sirkaDne) : []);
    const sirky = J.sirkySloupcu(sloupce, sirkaMm);

    const skupiny = oddily(s).map(o => s.rezim === 'doklad' ? rozlozDoklad(s, o, sloupce, sirky) : rozlozTabulku(s, o, sloupce, sirky));
    skupiny.forEach(ls => ls.forEach((l, i) => l.querySelectorAll('.cislo-strany').forEach(c => { c.textContent = ls.length > 1 ? `Strana ${i + 1} z ${ls.length}` : ''; })));
    const pocet = skupiny.flat().length;

    if (s.pouceni && s.pouceniText.trim()) listy.prepend(Object.assign(novyList('pokyny'), { innerHTML: J.textNaHtml(s.pouceniText) }));
    if (s.titulni) listy.prepend(titulniList(s, pocet));

    $('stylStranky').textContent = `@page{size:A4 ${s.orientace === 'na_sirku' ? 'landscape' : 'portrait'};margin:0}`;
    const n = listy.children.length;
    $('pocet').textContent = `${n} ${n === 1 ? 'list' : n < 5 ? 'listy' : 'listů'}`;
    prizpusobMeritko();
  }

  function prizpusobMeritko() {
    const sirkaPx = (stav.sab.orientace === 'na_sirku' ? 297 : 210) * 96 / 25.4;
    const k = Math.max(0.2, Math.min(1, ($('prostor').clientWidth - 24) / sirkaPx));
    $('listy').style.setProperty('--zoom', k.toFixed(4));
  }
  addEventListener('resize', () => { zavriNabidky(); prizpusobMeritko(); });

  // pro testy
  window.TISKOPIS_APP = { stav, org, vykresli, D, akceEditoru, importuj, prepniEditor, get vlastni() { return vlastni; } };
  naplnVyber();
  vykresli();
})();
