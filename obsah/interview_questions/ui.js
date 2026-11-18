/* Příprava výslechu – rozhraní (jádro: jadro.js → window.VYSLECH).
   Přípravy v localStorage 'webapp_interview_questions'; modelový případ (?pripad=17) zvlášť
   v 'webapp_interview_questions_pripad17' – uživatelovy přípravy se v tom režimu nečtou ani nepřepisují. */
(function () {
  'use strict';
  const V = window.VYSLECH;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KLIC = 'webapp_interview_questions';
  const KLIC_MODEL = 'webapp_interview_questions_pripad17';
  const MODEL = window.ModelovyPripad && ModelovyPripad.aktivni && window.MODELOVY_PRIPAD ? window.MODELOVY_PRIPAD : null;

  /* ---------- úložiště ---------- */
  let stav = { pripravy: [], posledni: null };   // uživatelovy přípravy
  let pr = null;                                  // otevřená příprava
  function nacti() {
    try {
      const o = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (o && Array.isArray(o.pripravy)) stav = { pripravy: o.pripravy.map(p => { try { return V.normalizuj(p); } catch (e) { return null; } }).filter(Boolean), posledni: o.posledni || null };
    } catch (e) { /* poškozená data – začne se znovu */ }
  }
  function uloz() {
    if (!pr) return;
    pr.zmeneno = Date.now();
    try {
      if (MODEL) localStorage.setItem(KLIC_MODEL, JSON.stringify(pr));
      else {
        stav.posledni = pr.id;
        localStorage.setItem(KLIC, JSON.stringify(stav));
      }
    } catch (e) { Dialog.chyba('Přípravu se nepodařilo uložit: ' + e.message); }
  }
  function otevri(p) {
    pr = p;
    vykresliVse();
    uloz();
  }

  /* ---------- vykreslení ---------- */
  const TYP_TRIDA = t => ({ riziko: 'riziko', pozor: 'pozor' }[V.TYPY[t].uroven] || (t === 'otevrena' ? 'ok-o' : ''));
  const stitek = (k, idp) => `<button type="button" class="typ ${TYP_TRIDA(k.typ)}" ${idp ? `data-detail="${idp}"` : ''} title="${esc(V.TYPY[k.typ].popis)}">${esc(V.TYPY[k.typ].nazev)}</button>`;

  function pravidlaHtml(k) {
    const r = k.pravidla.map(p => `<li><b>${esc(V.TYPY[p.typ].nazev)}</b> – <span>${esc(p.popis)}</span>${p.uryvek ? ` <q data-i18n="ne">${esc(p.uryvek)}</q>` : ''}</li>`).join('');
    return (r ? `<ul class="pravidla">${r}</ul>` : '') + k.navrhy.map(n => `<div class="navrh" data-i18n="ne">💡 ${esc(n)}</div>`).join('');
  }

  function vykresliHlavu() {
    $('fNazev').value = pr.nazev; $('fOsoba').value = pr.osoba; $('fRole').value = pr.role;
    $('fDatum').value = pr.datum || ''; $('fCil').value = pr.cil; $('fTemata').value = pr.temata;
    $('pouceni').innerHTML = V.POUCENI[pr.role].map(t => `<li>${esc(t)}</li>`).join('');
  }
  function vykresliKontrolu() {
    const k = V.kontrolaPlanu(pr);
    $('kontrola').innerHTML = k.length
      ? k.map(x => `<div class="${x.uroven}">${x.uroven === 'riziko' ? '⚠️' : 'ℹ️'} ${esc(x.text)}</div>`).join('')
      : '<div class="ok">✓ Plán má volné vyprávění, upřesnění i uzavření a žádnou rizikovou formulaci podle heuristiky.</div>';
  }

  let otevreneDetaily = new Set(), otevrenePoznamky = new Set();
  function vykresliPlan() {
    const m = V.poFazich(pr);
    let n = 0;
    $('plan').innerHTML = V.FAZE.map(f => `
      <section class="faze" data-faze="${f.id}">
        <header><span class="pism" aria-hidden="true">${f.pismeno}</span><h3>${esc(f.nazev)}</h3>
          <span class="poznamka">${esc(f.en)} · ${m[f.id].length}</span><span class="fpopis">${esc(f.popis)}</span></header>
        <ol>${m[f.id].map((p, i) => polozkaHtml(p, p.druh === 'pokyn' ? null : ++n, i, m[f.id].length)).join('') || '<li class="prazdne">Přetáhněte sem otázku nebo ji přidejte z banky.</li>'}</ol>
      </section>`).join('');
    vykresliKontrolu();
    vykresliBanku();
  }
  function polozkaHtml(p, cislo, i, delka) {
    const k = V.klasifikuj(p.text, p.druh);
    const vlastni = p.zdroj !== 'banka';
    const t = p.tech ? V.TECHNIKY[p.tech] : null;
    const zdroj = { banka: 'banka', vlastni: 'vlastní', pripad: 'spis případu' }[p.zdroj];
    return `<li class="pol${p.druh === 'pokyn' ? ' pokyn' : ''}" draggable="true" data-id="${p.id}">
      <span class="uchop" title="Přetáhnout (nebo šipky ▲▼)" aria-hidden="true">⋮⋮</span>
      <div>
        <div class="txt">${cislo ? `<span class="cislo">${cislo}.</span>` : '☐ '}<span${vlastni ? ' data-i18n="ne"' : ''}>${esc(p.text)}</span></div>
        <div class="meta">${p.druh === 'pokyn' ? '<span class="zdroj">úkol pro vyslýchajícího</span>' : stitek(k, p.id)}
          ${t ? `<span class="zdroj">🧠 ${esc(t.nazev)}</span>` : ''}<span class="zdroj">${zdroj}</span></div>
        ${t ? `<details class="tech"><summary>Proč a meze techniky</summary><div>${esc(t.proc)}</div><div class="meze">⚠️ ${esc(t.meze)}</div></details>` : ''}
        ${otevreneDetaily.has(p.id) && p.druh !== 'pokyn' ? `<div class="detail"><div>${esc(V.TYPY[k.typ].popis)}</div>${pravidlaHtml(k)}</div>` : ''}
        ${p.pozn || otevrenePoznamky.has(p.id) ? `<textarea class="vstup" data-pozn="${p.id}" rows="2" data-i18n="ne" placeholder="Poznámka k otázce (co sledovat, na co navázat)">${esc(p.pozn)}</textarea>` : ''}
      </div>
      <div class="akce">
        <button type="button" data-akce="nahoru" title="Posunout nahoru"${i === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" data-akce="dolu" title="Posunout dolů"${i === delka - 1 ? ' disabled' : ''}>▼</button>
        <button type="button" data-akce="pozn" title="Poznámka">📝</button>
        <button type="button" data-akce="uprav" title="Upravit text">✏️</button>
        <button type="button" data-akce="smaz" title="Odebrat z plánu">✕</button>
      </div></li>`;
  }

  /* banka */
  let filtrFaze = '';
  function vykresliCipy() {
    $('cipy').innerHTML = [['', 'Vše'], ...V.FAZE.map(f => [f.id, f.nazev])]
      .map(([id, n]) => `<button type="button" class="cip" data-cip="${id}" aria-pressed="${id === filtrFaze}">${esc(n)}</button>`).join('');
  }
  function vykresliBanku() {
    const q = norm($('hledej').value.trim());
    const vPlanu = new Set(pr.polozky.flatMap(p => [p.bankaId, p.text]).filter(Boolean));   // i podle textu (společné úkoly po změně role)
    const b = V.BANKA[pr.role].filter(x => (!filtrFaze || x.faze === filtrFaze) && (!q || norm(x.text).includes(q)));
    let html = '', posl = null;
    for (const x of b) {
      if (x.faze !== posl) { posl = x.faze; html += `<div class="bfaze">${esc(V.FAZE.find(f => f.id === x.faze).nazev)}</div>`; }
      const k = V.klasifikuj(x.text, x.druh), t = x.tech ? V.TECHNIKY[x.tech] : null;
      html += `<div class="bpol${x.druh === 'pokyn' ? ' pokyn' : ''}"><div>${t ? `<b>🧠 ${esc(t.nazev)}:</b> ` : ''}<span>${esc(x.text)}</span>
        <div class="meta">${x.druh === 'pokyn' ? '<span class="zdroj">úkol</span>' : stitek(k)}</div>
        ${t ? `<details class="tech"><summary>Proč a meze</summary><div>${esc(t.proc)}</div><div class="meze">⚠️ ${esc(t.meze)}</div></details>` : ''}</div>
        <div>${vPlanu.has(x.id) || vPlanu.has(x.text) ? '<span class="zdroj" title="Už je v plánu">✓</span>' : `<button type="button" class="btn mini" data-pridej="${x.id}" title="Přidat do plánu">➕</button>`}</div></div>`;
    }
    $('bankaSeznam').innerHTML = html || '<div class="prazdne">Nic neodpovídá filtru.</div>';
  }
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* skladatel vlastní otázky */
  function vykresliRozbor() {
    const t = $('vlastni').value.trim();
    if (!t) { $('rozbor').innerHTML = ''; return; }
    const k = V.klasifikuj(t, 'otazka');
    $('rozbor').innerHTML = `<div>${stitek(k)} <span>${esc(V.TYPY[k.typ].popis)}</span></div>${pravidlaHtml(k)}`;
  }

  function vykresliVse() {
    vykresliHlavu();
    $('vlastniFaze').innerHTML = V.FAZE.filter(f => !['P', 'Ev'].includes(f.id)).map(f => `<option value="${f.id}">${esc(f.nazev)}</option>`).join('');
    $('vlastniFaze').value = 'A2';
    vykresliCipy();
    vykresliPlan();
    vykresliRozbor();
    $('tlObnovModel').hidden = !MODEL;
  }

  /* ---------- události ---------- */
  const pole = { fNazev: 'nazev', fOsoba: 'osoba', fDatum: 'datum', fCil: 'cil', fTemata: 'temata' };
  Object.entries(pole).forEach(([id, k]) => $(id).addEventListener('input', () => { pr[k] = $(id).value; uloz(); }));
  $('fRole').addEventListener('change', () => {
    pr.role = $('fRole').value;
    vykresliHlavu(); vykresliPlan(); uloz();
  });
  $('hledej').addEventListener('input', vykresliBanku);
  $('cipy').addEventListener('click', e => { const c = e.target.closest('[data-cip]'); if (!c) return; filtrFaze = c.dataset.cip; vykresliCipy(); vykresliBanku(); });
  $('bankaSeznam').addEventListener('click', e => {
    const b = e.target.closest('[data-pridej]'); if (!b) return;
    const x = V.BANKA[pr.role].find(y => y.id === b.dataset.pridej); if (!x) return;
    const p = V.polozkaZBanky(x);
    pr.polozky.push(p); V.srovnej(pr);
    uloz(); vykresliPlan();
  });
  $('vlastni').addEventListener('input', vykresliRozbor);
  $('vlastniPridej').addEventListener('click', () => {
    const t = $('vlastni').value.trim();
    if (!t) { Dialog.info('Napište nejdřív otázku.'); return; }
    pr.polozky.push(V.novaPolozka($('vlastniFaze').value, t)); V.srovnej(pr);
    $('vlastni').value = ''; vykresliRozbor();
    uloz(); vykresliPlan();
  });
  $('vlastni').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('vlastniPridej').click(); });

  $('plan').addEventListener('click', async e => {
    const det = e.target.closest('[data-detail]');
    if (det) { const id = det.dataset.detail; otevreneDetaily.has(id) ? otevreneDetaily.delete(id) : otevreneDetaily.add(id); vykresliPlan(); return; }
    const b = e.target.closest('[data-akce]'); if (!b) return;
    const id = b.closest('.pol').dataset.id, p = pr.polozky.find(x => x.id === id);
    const a = b.dataset.akce;
    if (a === 'nahoru' || a === 'dolu') { V.posun(pr, id, a === 'nahoru' ? -1 : 1); uloz(); vykresliPlan(); focusAkce(id, a); }
    else if (a === 'smaz') { pr.polozky = pr.polozky.filter(x => x.id !== id); uloz(); vykresliPlan(); }
    else if (a === 'pozn') { otevrenePoznamky.add(id); vykresliPlan(); const t = document.querySelector(`[data-pozn="${id}"]`); if (t) t.focus(); }
    else if (a === 'uprav') {
      const t = await Dialog.zeptej('Text otázky', p.text);
      if (t == null || !t.trim() || t.trim() === p.text) return;
      p.text = t.trim(); p.zdroj = p.zdroj === 'banka' ? 'vlastni' : p.zdroj; p.bankaId = null; p.tech = null;
      uloz(); vykresliPlan();
    }
  });
  function focusAkce(id, a) { const b = document.querySelector(`.pol[data-id="${id}"] [data-akce="${a}"]`); if (b && !b.disabled) b.focus(); }
  $('plan').addEventListener('input', e => {
    const t = e.target.closest('[data-pozn]'); if (!t) return;
    const p = pr.polozky.find(x => x.id === t.dataset.pozn); if (p) { p.pozn = t.value; uloz(); }
  });

  /* tažení myší (HTML5 drag & drop) – na dotyku slouží šipky ▲▼ */
  let tazena = null;
  $('plan').addEventListener('dragstart', e => {
    const li = e.target.closest('.pol'); if (!li || e.target.closest('textarea')) return;
    tazena = li.dataset.id; li.classList.add('tazena');
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tazena);
  });
  $('plan').addEventListener('dragend', () => { tazena = null; document.querySelectorAll('.tazena,.nad,.cil-tazeni').forEach(x => x.classList.remove('tazena', 'nad', 'cil-tazeni')); });
  $('plan').addEventListener('dragover', e => {
    if (!tazena) return;
    const f = e.target.closest('.faze'); if (!f) return;
    e.preventDefault();
    document.querySelectorAll('.nad,.cil-tazeni').forEach(x => x.classList.remove('nad', 'cil-tazeni'));
    const li = e.target.closest('.pol');
    if (li && li.dataset.id !== tazena) li.classList.add('nad'); else f.classList.add('cil-tazeni');
  });
  $('plan').addEventListener('drop', e => {
    if (!tazena) return;
    const f = e.target.closest('.faze'); if (!f) return;
    e.preventDefault();
    const li = e.target.closest('.pol');
    V.presunNa(pr, tazena, f.dataset.faze, li && li.dataset.id !== tazena ? li.dataset.id : null);
    tazena = null; uloz(); vykresliPlan();
  });

  /* ---------- tisk ---------- */
  function vykresliTisk() {
    const m = V.poFazich(pr);
    const temata = String(pr.temata || '').split('\n').map(x => x.trim()).filter(Boolean);
    let n = 0;
    $('tisk').innerHTML = `<h1>Příprava výslechu</h1>
      <table><tr><td style="width:28%">Název</td><td data-i18n="ne">${esc(pr.nazev)}</td></tr>
      <tr><td>Vyslýchaná osoba</td><td data-i18n="ne">${esc(pr.osoba) || '&nbsp;'}</td></tr>
      <tr><td>Procesní postavení</td><td>${esc(V.ROLE[pr.role])}</td></tr>
      <tr><td>Datum</td><td>${esc(pr.datum)}</td></tr>
      <tr><td>Cíl výslechu</td><td data-i18n="ne">${esc(pr.cil) || '&nbsp;'}</td></tr></table>
      <h2>Poučení – připomenutí</h2><ul>${V.POUCENI[pr.role].map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="mala">Rozhoduje platné znění trestního řádu a formulář poučení útvaru.</div>
      ${temata.length ? `<h2>Témata k ověření</h2>${temata.map(t => `<div class="q" data-i18n="ne">☐ ${esc(t)}</div>`).join('')}` : ''}
      ${V.FAZE.filter(f => m[f.id].length).map(f => `<h2>${f.pismeno} – ${esc(f.nazev)} <span class="mala">(${esc(f.en)})</span></h2>
        ${m[f.id].map(p => {
          const k = V.klasifikuj(p.text, p.druh), vl = p.zdroj !== 'banka';
          if (p.druh === 'pokyn') return `<div class="q">☐ <span>${esc(p.text)}</span>${p.pozn ? `<div class="t" data-i18n="ne">${esc(p.pozn)}</div>` : ''}</div>`;
          return `<div class="q"><b>${++n}.</b> <span${vl ? ' data-i18n="ne"' : ''}>${esc(p.text)}</span> <span class="t">[${esc(V.TYPY[k.typ].nazev)}]</span>
            ${p.pozn ? `<div class="t" data-i18n="ne">📝 ${esc(p.pozn)}</div>` : ''}<div class="zaznam"></div></div>`;
        }).join('')}`).join('')}
      <p class="mala">Typ otázky určila heuristická kontrola formulace (pomůcka, ne verdikt). Model PEACE: Planning, Engage and explain, Account – clarify – challenge, Closure, Evaluation.</p>`;
  }
  window.addEventListener('beforeprint', vykresliTisk);

  /* ---------- příkazy a nabídky ---------- */
  function stahni(jmeno, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const jmenoSouboru = s => (s || 'priprava').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 50);
  const vModelu = () => { if (MODEL) Dialog.info('V modelovém případu 17/2026 se pracuje jen s modelovou přípravou. Vlastní přípravy najdete po otevření stránky bez ?pripad=17.'); return !!MODEL; };

  const PRIKAZY = {
    nova() {
      if (vModelu()) return;
      const p = V.novaPriprava(pr ? pr.role : 'svedek');
      stav.pripravy.push(p); otevri(p); Dialog.info('Nová příprava s výchozími úkoly a otázkami.');
    },
    duplikuj() {
      if (vModelu()) return;
      const p = V.normalizuj(JSON.parse(JSON.stringify(pr)));
      p.id = V.novaPriprava().id; p.nazev = pr.nazev + ' (kopie)';
      stav.pripravy.push(p); otevri(p);
    },
    pripravy() {
      if (vModelu()) return;
      vykresliSeznam(); $('dlgPripravy').showModal();
    },
    async smaz() {
      if (MODEL) { PRIKAZY.obnovModel(); return; }
      if (!await Dialog.potvrd('Smazat přípravu „' + pr.nazev + '“? Nelze vrátit.')) return;
      stav.pripravy = stav.pripravy.filter(p => p.id !== pr.id);
      if (!stav.pripravy.length) stav.pripravy.push(V.novaPriprava('svedek'));
      otevri(stav.pripravy[stav.pripravy.length - 1]);
    },
    async obnovModel() {
      if (!MODEL) return;
      if (!await Dialog.potvrd('Obnovit modelovou přípravu případu 17/2026? Vaše úpravy modelové přípravy se ztratí (vlastní přípravy zůstanou).')) return;
      otevri(V.modelovaPriprava(MODEL));
    },
    import() { if (vModelu()) return; $('soubor').value = ''; $('soubor').click(); },
    exportJeden() { stahni('priprava_vyslechu_' + jmenoSouboru(pr.nazev) + '.json', V.exportuj([pr])); },
    exportVse() { stahni('pripravy_vyslechu.json', V.exportuj(MODEL ? [pr] : stav.pripravy)); },
    async kopiruj() {
      try { await navigator.clipboard.writeText(V.textPlanu(pr)); Dialog.info('Plán zkopírován jako text.'); }
      catch (e) { Dialog.chyba('Schránka není dostupná.'); }
    },
    tisk() { vykresliTisk(); window.print(); },
    napMetoda() { napoveda('📘 Model PEACE', napMetoda()); },
    napTypy() { napoveda('🔎 Typy otázek a kontrola', napTypy()); },
    napKognitivni() { napoveda('🧠 Kognitivní rozhovor', napKognitivni()); }
  };
  $('soubor').addEventListener('change', async () => {
    const f = $('soubor').files[0]; if (!f) return;
    try {
      const nove = V.importuj(await f.text(), stav.pripravy.map(p => p.id));
      stav.pripravy.push(...nove); otevri(nove[nove.length - 1]);
      Dialog.info('Načteno příprav: ' + nove.length);
    } catch (e) { Dialog.chyba('Soubor nelze načíst: ' + e.message); }
  });

  function vykresliSeznam() {
    const s = [...stav.pripravy].sort((a, b) => b.zmeneno - a.zmeneno);
    $('seznamPriprav').innerHTML = s.map(p => `<div class="rad${p.id === pr.id ? ' aktivni' : ''}">
      <div class="n"><b data-i18n="ne">${esc(p.nazev)}</b><br><small><span>${esc(V.ROLE[p.role])}</span> · <span data-i18n="ne">${esc(p.osoba || '—')}</span> · ${p.polozky.length} ·
        ${new Date(p.zmeneno).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
      <button type="button" class="btn mini" data-otevri="${p.id}">Otevřít</button></div>`).join('')
      + '<button type="button" class="btn" data-prikaz="nova">🆕 Nová příprava</button>';
  }
  $('seznamPriprav').addEventListener('click', e => {
    const b = e.target.closest('[data-otevri]'); if (!b) return;
    const p = stav.pripravy.find(x => x.id === b.dataset.otevri);
    if (p) { otevri(p); $('dlgPripravy').close(); }
  });
  document.querySelectorAll('[data-zavri]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  function napoveda(nadpis, html) { $('napNadpis').textContent = nadpis; $('napTelo').innerHTML = html; $('dlgNapoveda').showModal(); }
  function napMetoda() {
    return `<p>PEACE je model vyšetřovacího rozhovoru zavedený v 90. letech v Anglii a Walesu. Klade důraz na získání co nejpřesnější a nejúplnější výpovědi místo na doznání; vyslýchající má být nestranný a připravený.</p>
      ${V.FAZE.map(f => `<h3>${f.pismeno} – ${esc(f.nazev)} <small>(${esc(f.en)})</small></h3><p>${esc(f.popis)}</p>`).join('')}
      <p class="poznamka">Pořadí v plánu je doporučení, ne scénář – rozhovor se řídí tím, co vyslýchaný řekne. Zjištění, která by mohla výpověď ovlivnit, patří až do fáze konfrontace.</p>`;
  }
  function napTypy() {
    const priklady = { otevrena: 'Popište, co se stalo.', upresnujici: 'Kde jste v tu dobu stál/a?', uzavrena: 'Měl na sobě bundu?', sugestivni: 'Nebyl to Brabec? · Byl jste tam, že?', vicenasobna: 'Kde jste byl a co jste dělal?', predpoklad: 'Viděl jste ten nůž? · Kdy jste přestal…?' };
    return `<p>Každá otázka v plánu i v bance má štítek typu. Klik na štítek v plánu ukáže, které pravidlo se chytilo, a návrh otevřenější formulace.</p>
      <ul>${Object.keys(priklady).map(t => `<li><b>${esc(V.TYPY[t].nazev)}</b> – <span>${esc(V.TYPY[t].popis)}</span> <i data-i18n="ne">„${esc(priklady[t])}“</i></li>`).join('')}</ul>
      <h3>Jak kontrola funguje a kde selhává</h3>
      <p>Heuristika v jádru (<code>interview_questions/jadro.js</code>) hledá v textu typické vzorce češtiny: tázací slovo na začátku, výzvy „Popište / Řekněte“, záporné otázky („Nebyl…“), dovětky „…, že?“, tvrzení „Je pravda, že…“, slova „přece, určitě“, spojky „a / nebo“ před druhou otázkou nebo druhým slovesem, ukazovací zájmena („ten nůž“) a „Proč jste…“ či „přestal“. Pokud je ve stejném textu věc předem uvedena (předložené zjištění), ukazovací zájmeno se neoznačí.</p>
      <p>Nezná ale kontext rozhovoru: neví, co už vyslýchaný sám řekl, nepozná ironii ani tón a může se mýlit oběma směry. Výsledek je upozornění k zamyšlení, ne hodnocení kvality výslechu. Uzavřené otázky nejsou chybou – jen patří až na konec tématu.</p>
      <p>Pracuje jen s češtinou: text, který česky nevypadá, označí jako „neklasifikováno“. Otázky z banky se i v anglickém rozhraní hodnotí podle českého originálu.</p>`;
  }
  function napKognitivni() {
    return `<p>Kognitivní rozhovor (R. Fisher, E. Geiselman) je soubor technik, které pomáhají spolupracujícímu svědkovi nebo poškozenému vybavit si víc přesných podrobností. Pro výslech podezřelého, který nespolupracuje, není určen. Techniky jsou v bance u svědka a poškozeného ve fázích vyprávění a upřesnění.</p>
      ${Object.values(V.TECHNIKY).map(t => `<h3>${esc(t.nazev)}</h3><p><i>${esc(t.text)}</i></p><p>${esc(t.proc)}</p><p class="poznamka">⚠️ ${esc(t.meze)}</p>`).join('')}
      <p class="poznamka">U dětí, osob s mentálním postižením a traumatizovaných osob platí zvláštní postupy a výslech vede k tomu vyškolená osoba; tato pomůcka je nenahrazuje.</p>`;
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
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]');
    if (p) { e.stopPropagation(); zavriNabidky(); if (p.closest('dialog')) p.closest('dialog').close(); return PRIKAZY[p.dataset.prikaz](); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });

  /* ---------- start ---------- */
  if (MODEL) {
    let p = null;
    try { const o = JSON.parse(localStorage.getItem(KLIC_MODEL) || 'null'); if (o) p = V.normalizuj(o); } catch (e) { p = null; }
    otevri(p || V.modelovaPriprava(MODEL));
  } else {
    nacti();
    if (!stav.pripravy.length) stav.pripravy.push(V.novaPriprava('svedek'));
    otevri(stav.pripravy.find(p => p.id === stav.posledni) || stav.pripravy[stav.pripravy.length - 1]);
  }
  window.VYSLECH_APP = { PRIKAZY, priprava: () => pr, stav: () => stav, model: !!MODEL, vykresliTisk };
})();
