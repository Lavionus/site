/* UI Porovnání otisků souborů – dávka/složka, manifest, dva soubory, záznam o ověření.
   Výpočet běží ve workeru (hash_compare/worker.js), logika manifestů v HASHJADRO (jadro.js).
   Ukládá se jen nastavení (webapp_hash_compare_nast), soubory a otisky ne. */
(function () {
  'use strict';
  const H = window.HASHJADRO;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_hash_compare_nast';
  const STAVY = {
    shoda: '✅ shoda', zmeneno: '❌ změněno', chybi: '❌ chybí ve složce', navic: '➕ navíc ve složce',
    prejmenovano: '↪ přejmenováno', neovereno: '– neověřeno',
  };
  const VERDIKT = { nepotvrzena: '❌ Integrita NEPOTVRZENA', neuplne: '⚠ Ověření neúplné', potvrzena: '✅ Všechny soubory z manifestu se shodují' };
  const POPIS_ALG = { 'SHA-256': 'SHA-256 (FIPS 180-4)', 'SHA-384': 'SHA-384 (FIPS 180-4)', 'SHA-512': 'SHA-512 (FIPS 180-4)', 'SHA-1': 'SHA-1 (FIPS 180-4, kryptograficky slabý)', 'MD5': 'MD5 (RFC 1321, kryptograficky slabý)' };

  let nast = { algoritmy: ['SHA-256'], algDva: 'SHA-256', overil: '', utvar: '' };
  try {
    const ul = JSON.parse(localStorage.getItem(KLIC) || '{}');
    if (ul && typeof ul === 'object' && !Array.isArray(ul)) Object.assign(nast, ul);
  } catch (e) { /* výchozí */ }
  nast.algoritmy = Array.isArray(nast.algoritmy) ? H.ALGORITMY.filter(a => nast.algoritmy.includes(a)) : [];
  if (!nast.algoritmy.length) nast.algoritmy = ['SHA-256'];
  if (!H.ALGORITMY.includes(nast.algDva)) nast.algDva = 'SHA-256';
  nast.overil = typeof nast.overil === 'string' ? nast.overil : ''; nast.utvar = typeof nast.utvar === 'string' ? nast.utvar : '';
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } }

  let soubory = [];          // {cesta, velikost, zmeneno, file, otisky:{}, chyba?, poznamky?}
  let manifest = null;       // {nazev, otisk, data: parsujManifest()}
  let porovnani = null;
  let filtr = null;
  const dva = { A: null, B: null };

  // ---------- worker: fronta po souborech ----------
  let worker = null, dalsiId = 1;
  const cekajici = new Map();
  function dejWorker() {
    if (!worker) {
      worker = new Worker('hash_compare/worker.js');
      worker.onmessage = e => {
        const c = cekajici.get(e.data.id); if (!c) return;
        if (e.data.prubeh != null) { c.prubeh && c.prubeh(e.data.prubeh); return; }
        cekajici.delete(e.data.id); c.hotovo(e.data);
      };
    }
    return worker;
  }
  function spocitejSoubor(file, algoritmy, prubeh) {
    return new Promise(hotovo => {
      const id = dalsiId++;
      cekajici.set(id, { hotovo, prubeh });
      dejWorker().postMessage({ id, soubor: file, algoritmy });
    });
  }
  function zastavWorker() {
    if (worker) worker.terminate();
    worker = null;
    cekajici.forEach(c => c.hotovo({ zruseno: true, otisky: {} }));
    cekajici.clear();
  }

  let bezi = false, zrusit = false;
  async function spocitejDavku() {
    if (bezi) return;
    bezi = true; zrusit = false;
    // čeká = algoritmy, které soubor ještě nemá a ještě se nezkoušely (SHA-512 nad 1 GiB se nespočítá → nezkoušet znovu)
    const ceka = s => !s.chyba && nast.algoritmy.filter(a => !s.otisky[a] && !(s.zkouseno && s.zkouseno[a]));
    let fronta;
    // soubory nebo algoritmy přidané během výpočtu se dopočítají v dalším kole
    while (!zrusit && (fronta = soubory.filter(s => (ceka(s) || []).length)).length) {
      const celkemB = fronta.reduce((x, s) => x + s.velikost, 0) || 1;
      let hotovoB = 0, n = 0;
      const velke = fronta.filter(s => s.velikost > 1024 * 1024 * 1024).length;
      if (velke) Dialog.info(`${velke} soubor(ů) nad 1 GiB – počítá se po blocích, může to trvat.`);
      $('prubeh').hidden = false;
      for (const s of fronta) {
        if (zrusit) break;
        const chybi = ceka(s) || [];
        if (!chybi.length) continue;
        $('prubehText').textContent = `Počítám ${n + 1} / ${fronta.length}: ${s.cesta}`;
        const r = await spocitejSoubor(s.file, chybi, p => { $('prubehBar').value = (hotovoB + p * s.velikost) / celkemB; });
        if (r.zruseno) break;
        s.zkouseno = Object.assign(s.zkouseno || {}, ...chybi.map(a => ({ [a]: true })));
        Object.assign(s.otisky, r.otisky);
        if (r.chyba) s.chyba = r.chyba;
        if (r.poznamky && r.poznamky.length) s.poznamky = r.poznamky;
        hotovoB += s.velikost; n++;
        $('prubehBar').value = hotovoB / celkemB;
        if (n % 20 === 0 || s.velikost > 8e6) vykresli();
      }
    }
    $('prubeh').hidden = true;
    bezi = false;
    if (zrusit) Dialog.info('Výpočet zrušen.');
    prepocitej();
  }

  // ---------- přidání souborů ----------
  function pridej(seznam) {   // [{file, cesta}]
    if (!seznam.length) return;
    const podle = new Map(soubory.map(s => [s.cesta, s]));
    seznam.forEach(({ file, cesta }) => {
      podle.set(cesta, { cesta, velikost: file.size, zmeneno: file.lastModified, file, otisky: {} });
    });
    soubory = [...podle.values()].sort((a, b) => (a.cesta < b.cesta ? -1 : 1));
    prepnoutZal('davka');
    vykresli();
    spocitejDavku();
  }
  function zInputu(input) {
    pridej([...input.files].map(f => ({ file: f, cesta: H.normCesta(f.webkitRelativePath || f.name) })));
    input.value = '';
  }
  // přetažení: webkitGetAsEntry, složky rekurzivně (readEntries vrací po dávkách)
  async function zPretazeni(dt) {
    const vstupy = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (!vstupy.length) return pridej([...dt.files].map(f => ({ file: f, cesta: f.name })));
    const out = [];
    async function projdi(e) {
      if (e.isFile) {
        const file = await new Promise((ok, chyba) => e.file(ok, chyba)).catch(() => null);
        if (file) out.push({ file, cesta: H.normCesta(e.fullPath || file.name) });
      } else if (e.isDirectory) {
        const ctenar = e.createReader();
        for (;;) {
          const davka = await new Promise((ok, chyba) => ctenar.readEntries(ok, chyba)).catch(() => []);
          if (!davka.length) break;
          for (const d of davka) await projdi(d);
        }
      }
    }
    for (const e of vstupy) await projdi(e);
    pridej(out);
  }

  // ---------- manifest ----------
  async function nactiManifest(file) {
    const text = await file.text();
    const data = H.parsujManifest(text);
    if (!data.polozky.length) { Dialog.chyba('V souboru nebyl nalezen žádný otisk – podporované formáty: sha256sum/md5sum, BSD, CSV, JSON.'); return; }
    const otisk = H.hex(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())));
    manifest = { nazev: file.name, velikost: file.size, otisk, data };
    const chybi = data.algoritmy.filter(a => !nast.algoritmy.includes(a));
    if (!data.algoritmy.some(a => nast.algoritmy.includes(a)) && chybi.length) {
      nast.algoritmy.push(chybi[0]);
      nast.algoritmy = H.ALGORITMY.filter(a => nast.algoritmy.includes(a)); uloz(); oznacAlg();
      Dialog.info(`Manifest používá ${chybi[0]} – algoritmus byl přidán k výpočtu.`);
    }
    prepnoutZal('davka');
    prepocitej();
    spocitejDavku();
  }

  function prepocitej() {
    porovnani = manifest && soubory.length ? H.porovnej(manifest.data, soubory) : null;
    if (manifest && !soubory.length) porovnani = H.porovnej(manifest.data, []);
    vykresli();
  }

  // ---------- vykreslení ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));
  function velikost(b) {
    if (b == null) return '';
    if (b < 1024) return b + ' B';
    const j = ['KiB', 'MiB', 'GiB', 'TiB']; let i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < 3);
    return b.toFixed(b < 10 ? 2 : 1).replace('.', ',') + ' ' + j[i];
  }
  const datum = ms => (ms ? new Date(ms).toLocaleString('cs-CZ') : '');

  function radky() {
    if (porovnani) return porovnani.vysledky.map(v => ({ stav: v.stav, cesta: v.cesta, puvodni: v.puvodni, s: v.soubor, m: v.manifest }));
    return soubory.map(s => ({ stav: null, cesta: s.cesta, s, m: null }));
  }

  function vykresli() {
    // manifest
    $('manifestKarta').hidden = !manifest;
    if (manifest) {
      const d = manifest.data;
      $('manifestInfo').innerHTML = `<b>${esc(manifest.nazev)}</b> · formát ${esc(d.format === 'sum' ? 'sha*sum / md5sum' : d.format.toUpperCase())} · ${d.polozky.length} položek · ${esc(d.algoritmy.join(', '))}<br>`
        + `SHA-256 manifestu: <span class="mono" style="word-break:break-all">${manifest.otisk}</span>`
        + (porovnani && porovnani.algoritmus ? `<br>Porovnává se podle <b>${porovnani.algoritmus}</b>${H.SLABE[porovnani.algoritmus] ? ' <span class="slaby">⚠ slabý algoritmus</span>' : ''}` : '')
        + (d.chyby.length ? `<div class="chyby-manifestu">⚠ Přeskočené řádky (${d.chyby.length}): ${esc(d.chyby.slice(0, 5).map(c => 'ř. ' + c.radek + ' ' + c.text).join('; '))}${d.chyby.length > 5 ? '…' : ''}</div>` : '')
        + ` <button class="tl" data-prikaz="zavritManifest" style="margin-top:6px">✖ Zavřít manifest</button>`;
    }
    // souhrn
    const vse = radky();
    let s = '';
    if (porovnani) {
      s = `<button class="cip" data-filtr="" aria-pressed="${!filtr}">Vše<span class="n">${porovnani.celkem}</span></button>`;
      Object.keys(STAVY).forEach(k => {
        if (porovnani.souhrn[k]) s += `<button class="cip st-${k}" data-filtr="${k}" aria-pressed="${filtr === k}">${STAVY[k]}<span class="n">${porovnani.souhrn[k]}</span></button>`;
      });
      const v = H.verdikt(porovnani.souhrn);
      s += `<span class="cip" style="cursor:default;border-color:${v === 'nepotvrzena' ? 'var(--danger)' : v === 'potvrzena' ? 'var(--ok)' : 'var(--warn)'}">${VERDIKT[v]}</span>`;
    } else if (soubory.length) {
      const b = soubory.reduce((x, f) => x + f.velikost, 0);
      s = `<span class="cip" style="cursor:default">${soubory.length} souborů · ${velikost(b)}</span>`;
    }
    $('souhrn').innerHTML = s;
    // tabulka
    const alg = porovnani && porovnani.algoritmus ? [porovnani.algoritmus].concat(nast.algoritmy.filter(a => a !== porovnani.algoritmus)) : nast.algoritmy;
    const rad = vse.filter(r => !filtr || r.stav === filtr);
    if (!vse.length) { $('tabulka').innerHTML = '<tbody><tr><td class="prazdno">Zatím žádné soubory. Vyber složku nebo soubory – nebo nejdřív načti manifest.</td></tr></tbody>'; return; }
    let h = '<thead><tr><th>#</th>' + (porovnani ? '<th>Výsledek</th>' : '') + '<th>Cesta</th><th>Velikost</th><th>Změněno</th>'
      + alg.map(a => `<th>${a}${H.SLABE[a] ? ' ⚠' : ''}</th>`).join('') + '</tr></thead><tbody>';
    rad.forEach((r, i) => {
      const f = r.s;
      h += `<tr><td class="cislo">${i + 1}</td>`
        + (porovnani ? `<td class="stav st-${r.stav}">${STAVY[r.stav]}</td>` : '')
        + `<td class="cesta">${esc(r.cesta)}${r.puvodni ? `<span class="puvodni">v manifestu: ${esc(r.puvodni)}</span>` : ''}${f && f.chyba ? `<span class="puvodni st-chybi">chyba: ${esc(f.chyba)}</span>` : ''}${f && f.poznamky ? `<span class="puvodni">${esc(f.poznamky.join('; '))}</span>` : ''}</td>`
        + `<td class="cislo">${f ? velikost(f.velikost) : velikost(r.m && r.m.velikost)}</td><td class="cislo">${f ? datum(f.zmeneno) : ''}</td>`
        + alg.map(a => {
          const hs = f && f.otisky[a], hm = r.m && r.m.otisky[a];
          if (!f) return `<td class="otisk">${hm ? esc(hm) + '<span class="puvodni">(z manifestu)</span>' : ''}</td>`;
          if (r.stav === 'zmeneno' && a === porovnani.algoritmus) return `<td class="otisk">${esc(hs)}<span class="puvodni st-zmeneno">manifest: ${esc(hm)}</span></td>`;
          return `<td class="otisk">${hs ? esc(hs) : (bezi && !f.chyba ? '…' : '')}</td>`;
        }).join('') + '</tr>';
    });
    $('tabulka').innerHTML = h + '</tbody>';
    if (!$('pZaznam').hidden) vykresliZaznam();
  }

  // ---------- dva soubory ----------
  async function dvaSpocitej(k) {
    const f = dva[k]; if (!f) return;
    $('hash' + k).textContent = '…';
    const r = await spocitejSoubor(f, [nast.algDva]);
    $('hash' + k).textContent = r.otisky[nast.algDva] || ('chyba: ' + (r.chyba || (r.poznamky || []).join('; ')));
    dvaVysledek();
  }
  function dvaVysledek() {
    const res = $('result'), a = $('hashA').textContent, b = $('hashB').textContent;
    const plny = x => /^[0-9a-f]{32,}$/.test(x);
    if (!plny(a) || !plny(b)) { res.className = 'result pending'; res.textContent = 'Nahraj oba soubory pro porovnání'; return; }
    if (a === b) { res.className = 'result match'; res.textContent = '✅ Otisky souhlasí — soubory jsou identické'; }
    else { res.className = 'result nomatch'; res.textContent = '❌ Otisky se liší — soubory nejsou identické'; }
  }
  function nastavDrop(k) {
    const drop = $('drop' + k), file = $('file' + k);
    drop.onclick = () => file.click();
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('nad'); };
    drop.ondragleave = () => drop.classList.remove('nad');
    drop.ondrop = e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('nad'); if (e.dataTransfer.files[0]) nacti(e.dataTransfer.files[0]); };
    file.onchange = () => { if (file.files[0]) nacti(file.files[0]); file.value = ''; };
    function nacti(f) {
      dva[k] = f;
      $('name' + k).textContent = '📄 ' + f.name + ' (' + velikost(f.size) + ')';
      dvaSpocitej(k);
    }
  }

  // ---------- záznam o ověření ----------
  function vykresliZaznam() {
    const ted = new Date();
    const posun = -ted.getTimezoneOffset(), pz = (posun >= 0 ? '+' : '−') + String(Math.floor(Math.abs(posun) / 60)).padStart(2, '0') + ':' + String(Math.abs(posun) % 60).padStart(2, '0');
    const verze = window.VERZE_STRANEK && window.VERZE_STRANEK['obsah/hash_compare.html'];
    let polozky, alg, souhrnHtml = '', zdroj;
    if (soubory.length || manifest) {
      alg = porovnani && porovnani.algoritmus ? porovnani.algoritmus : nast.algoritmy[0];
      polozky = radky().map(r => ({ cesta: r.cesta, puvodni: r.puvodni, vel: r.s ? r.s.velikost : r.m && r.m.velikost, otisk: (r.s && r.s.otisky[alg]) || (r.m && r.m.otisky[alg]) || '', stav: r.stav }));
      zdroj = 'dávka';
    } else if (dva.A || dva.B) {
      alg = nast.algDva;
      const a = $('hashA').textContent, b = $('hashB').textContent, plny = x => /^[0-9a-f]{32,}$/.test(x);
      const shoda = plny(a) && plny(b) ? (a === b ? 'shoda' : 'zmeneno') : 'neovereno';
      polozky = ['A', 'B'].filter(k => dva[k]).map(k => ({ cesta: 'Soubor ' + k + ': ' + dva[k].name, vel: dva[k].size, otisk: $('hash' + k).textContent, stav: dva.A && dva.B ? shoda : null }));
      zdroj = 'dva';
    } else polozky = [];
    if (porovnani) {
      const s = porovnani.souhrn, v = H.verdikt(s);
      souhrnHtml = `<p><b>Výsledek: ${v === 'nepotvrzena' ? 'integrita NEPOTVRZENA' : v === 'neuplne' ? 'ověření NEÚPLNÉ (část souborů není ověřena)' : 'integrita potvrzena'}</b> – shoda ${s.shoda}, změněno ${s.zmeneno}, chybí ve složce ${s.chybi}, navíc ve složce ${s.navic}, přejmenováno ${s.prejmenovano}${s.neovereno ? ', neověřeno ' + s.neovereno : ''} (celkem ${porovnani.celkem}).</p>`;
    } else if (zdroj === 'dva' && dva.A && dva.B) {
      const st = polozky[0].stav;
      souhrnHtml = `<p><b>Výsledek: ${st === 'shoda' ? 'otisky obou souborů se shodují – soubory jsou bitově totožné' : st === 'zmeneno' ? 'otisky se liší – soubory nejsou totožné' : 'otisky nejsou spočítané – nelze rozhodnout'}</b></p>`;
    } else if (polozky.length) {
      const b = soubory.reduce((x, f) => x + f.velikost, 0);
      souhrnHtml = `<p><b>Zajištění otisků:</b> ${polozky.length} souborů, celkem ${velikost(b)} (${b} B). Referenční manifest nebyl porovnáván.</p>`;
    }
    const slabe = alg && H.SLABE[alg];
    $('zaznam').innerHTML = `
      <h3>ZÁZNAM O OVĚŘENÍ INTEGRITY DIGITÁLNÍCH DAT</h3>
      <div class="podtitul">výpočet kryptografických otisků (hash) souborů</div>
      <dl>
        <dt>Věc / č. j.</dt><dd>${esc($('zVec').value) || '………………………………'}</dd>
        <dt>Datum a čas ověření</dt><dd>${ted.toLocaleString('cs-CZ')} (UTC${pz}) · ${ted.toISOString()}</dd>
        <dt>Ověřil</dt><dd>${esc(nast.overil) || '………………………………'}${nast.utvar ? ', ' + esc(nast.utvar) : ''}</dd>
        <dt>Nástroj</dt><dd>Porovnání otisků souborů (lavionus.github.io/site/obsah/hash_compare.html)${verze ? ', verze stránky ' + verze[0] + ' z ' + verze[1] : ''}${window.VERZE_WEBU ? ', web ' + window.VERZE_WEBU : ''}</dd>
        <dt>Algoritmus</dt><dd>${alg ? esc(POPIS_ALG[alg]) : '–'}; výpočet Web Crypto API prohlížeče (crypto.subtle), u souborů nad 256 MiB a u MD5 ověřená vlastní implementace v JavaScriptu</dd>
        <dt>Prostředí</dt><dd style="font-size:.72rem">${esc(navigator.userAgent)}</dd>
        ${manifest ? `<dt>Referenční manifest</dt><dd>${esc(manifest.nazev)} (${manifest.data.polozky.length} položek, ${manifest.velikost} B)<br>SHA-256 manifestu: <span class="mono" style="word-break:break-all">${manifest.otisk}</span></dd>` : ''}
        ${$('zPozn').value ? `<dt>Poznámka</dt><dd>${esc($('zPozn').value)}</dd>` : ''}
      </dl>
      <h4>Souhrn</h4>${souhrnHtml || '<p>Nebyly vybrány žádné soubory.</p>'}
      ${polozky.length ? `<h4>Seznam souborů</h4><div class="tab-obal" style="border:0"><table><thead><tr><th>#</th><th>Cesta</th><th>Velikost (B)</th><th>${esc(alg)}</th>${polozky.some(p => p.stav) ? '<th>Výsledek</th>' : ''}</tr></thead><tbody>`
        + polozky.map((p, i) => `<tr><td class="cislo">${i + 1}</td><td class="cesta">${esc(p.cesta)}${p.puvodni ? `<span class="puvodni">v manifestu: ${esc(p.puvodni)}</span>` : ''}</td><td class="cislo">${p.vel != null ? p.vel : ''}</td><td class="otisk">${esc(p.otisk)}</td>${polozky.some(x => x.stav) ? `<td class="stav st-${p.stav}">${p.stav ? STAVY[p.stav] : ''}</td>` : ''}</tr>`).join('')
        + '</tbody></table></div>' : ''}
      <p class="pozn">Otisky byly vypočteny lokálně ve webovém prohlížeči na zařízení ověřující osoby; soubory ani otisky nebyly odeslány na žádný server. Shoda otisku potvrzuje bitovou totožnost obsahu, nikoli název, datum ani původ souboru.${slabe ? ' Použitý algoritmus ' + alg + ' je kryptograficky slabý (známé kolize) – výsledek slouží jen ke shodě se starším manifestem, ne jako důkaz proti záměrné manipulaci.' : ''}</p>
      <div class="podpisy"><div>Podpis ověřující osoby</div><div>Datum, razítko</div></div>`;
  }

  // ---------- export ----------
  function stahni(text, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: typ }));
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function kExportu() {
    const s = soubory.filter(f => Object.keys(f.otisky).length);
    if (!s.length) { Dialog.chyba('Nejsou spočítané žádné otisky k exportu.'); return null; }
    if (bezi) Dialog.info('Výpočet ještě běží – export obsahuje jen hotové soubory.');
    return s;
  }
  const zaklad = () => 'otisky_' + new Date().toISOString().slice(0, 10);

  // ---------- příkazy a ovládání ----------
  const PRIKAZY = {
    slozka: () => $('vstSlozka').click(),
    soubory: () => $('vstSoubory').click(),
    manifest: () => $('vstManifest').click(),
    zaznam: () => prepnoutZal('zaznam'),
    tisk: () => { prepnoutZal('zaznam'); vykresliZaznam(); window.print(); },
    napoveda: () => $('dlgNapoveda').showModal(),
    zavritManifest: () => { manifest = null; filtr = null; prepocitej(); },
    exportSum: () => {
      const s = kExportu(); if (!s) return;
      const a = nast.algoritmy.includes('SHA-256') ? 'SHA-256' : nast.algoritmy[0];
      stahni(H.manifestSum(s, a), zaklad() + '.' + a.replace('-', '').toLowerCase(), 'text/plain');
    },
    exportCsv: () => { const s = kExportu(); if (s) stahni('\uFEFF' + H.manifestCsv(s, nast.algoritmy), zaklad() + '.csv', 'text/csv'); },
    exportJson: () => {
      const s = kExportu(); if (!s) return;
      stahni(H.manifestJson(s, nast.algoritmy, { overil: nast.overil || undefined }), zaklad() + '.json', 'application/json');
    },
    vymazat: async () => {
      if ((soubory.length || manifest) && !(await Dialog.potvrd('Vymazat seznam souborů i načtený manifest?'))) return;
      if (bezi) { zrusit = true; zastavWorker(); }
      soubory = []; manifest = null; porovnani = null; filtr = null; vykresli();
    },
  };
  window.HASH_COMPARE_APP = { PRIKAZY, soubory: () => soubory, porovnani: () => porovnani, manifest: () => manifest, nast: () => nast, bezi: () => bezi };

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
    const p = e.target.closest('[data-prikaz]');
    if (p && !p.disabled) { e.stopPropagation(); zavriNabidky(); PRIKAZY[p.dataset.prikaz](); return; }
    const a = e.target.closest('[data-alg]');
    if (a) {
      const x = a.dataset.alg, i = nast.algoritmy.indexOf(x);
      if (i >= 0 && nast.algoritmy.length > 1) nast.algoritmy.splice(i, 1);
      else if (i < 0) nast.algoritmy.push(x);
      nast.algoritmy = H.ALGORITMY.filter(y => nast.algoritmy.includes(y));
      uloz(); oznacAlg(); prepocitej(); spocitejDavku();
      return;
    }
    const f = e.target.closest('[data-filtr]');
    if (f) { filtr = f.dataset.filtr || null; vykresli(); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });
  function oznacAlg() { document.querySelectorAll('[data-alg]').forEach(b => b.setAttribute('aria-pressed', nast.algoritmy.includes(b.dataset.alg))); }

  function prepnoutZal(z) {
    document.querySelectorAll('[data-zal]').forEach(b => b.setAttribute('aria-selected', b.dataset.zal === z));
    $('pDavka').hidden = z !== 'davka'; $('pDva').hidden = z !== 'dva'; $('pZaznam').hidden = z !== 'zaznam';
    if (z === 'zaznam') vykresliZaznam();
  }
  document.querySelectorAll('[data-zal]').forEach(b => b.addEventListener('click', () => prepnoutZal(b.dataset.zal)));

  $('vstSlozka').onchange = e => zInputu(e.target);
  $('vstSoubory').onchange = e => zInputu(e.target);
  $('vstManifest').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) nactiManifest(f); };
  $('btnZrusit').onclick = () => { zrusit = true; zastavWorker(); };
  const drop = $('dropDavka');
  drop.addEventListener('click', e => { if (!e.target.closest('button')) $('vstSoubory').click(); });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === drop) $('vstSoubory').click(); });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('nad'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('nad'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('nad'); zPretazeni(e.dataTransfer); });

  nastavDrop('A'); nastavDrop('B');
  $('algo').value = nast.algDva;
  function dvaPoznamka() {   // text pod porovnáním podle zvoleného algoritmu
    const a = nast.algDva, slaby = !!H.SLABE[a];
    $('dvaSilny').hidden = slaby; $('dvaSlaby').hidden = !slaby;
    document.querySelectorAll('.dvaAlg').forEach(b => { b.textContent = a; });
  }
  $('algo').addEventListener('change', () => { nast.algDva = $('algo').value; uloz(); dvaPoznamka(); dvaSpocitej('A'); dvaSpocitej('B'); });
  dvaPoznamka();
  $('zOveril').value = nast.overil; $('zUtvar').value = nast.utvar;
  ['zOveril', 'zUtvar'].forEach(id => $(id).addEventListener('input', () => { nast[id === 'zOveril' ? 'overil' : 'utvar'] = $(id).value.trim(); uloz(); vykresliZaznam(); }));
  ['zVec', 'zPozn'].forEach(id => $(id).addEventListener('input', vykresliZaznam));
  oznacAlg();
  vykresli();
})();
