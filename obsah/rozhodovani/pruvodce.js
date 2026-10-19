/* rozhodovani/pruvodce.js – průvodce rozhodnutím krok za krokem (varianty → kritéria → váhy → hodnocení → výsledek).
   Data a výpočty sdílí s plnou analýzou přes window.RozhodovaniUI. */
(function () {
  'use strict';
  const UI = window.RozhodovaniUI, J = window.Rozhodovani, G = window.RozhodovaniGrafy;
  const esc = G.esc, F = J.formatCislo;
  const $ = id => document.getElementById(id);
  const KLIC_KROK = 'webapp_rozhodovani_krok';
  let krok = 1, kritIdx = 0;
  try { const k = +localStorage.getItem(KLIC_KROK); if (k >= 1 && k <= 5) krok = k; } catch (e) { /* nic */ }

  const P = () => UI.projekt();
  const S = () => UI.stav();
  const NADPISY = ['', 'Mezi čím se rozhodujete?', 'Podle čeho se rozhodujete?', 'Co je pro vás důležitější?', 'Jak si varianty stojí?', 'Výsledek'];

  function vyplnenoKrit(j) { return P().alternativy.every(a => typeof a.hodnoty[j] === 'number' && isFinite(a.hodnoty[j])); }
  function hotovo(k) {
    const p = P();
    if (k === 1) return p.alternativy.length >= 2 && p.alternativy.every(a => a.nazev.trim());
    if (k === 2) return p.kriteria.length >= 1 && p.kriteria.every(x => x.nazev.trim());
    if (k === 3) return krok > 3;
    if (k === 4) return S() && S().kon.ok;
    return S() && S().ok;
  }
  function nastavKrok(k) {
    krok = Math.max(1, Math.min(5, k));
    try { localStorage.setItem(KLIC_KROK, String(krok)); } catch (e) { /* nic */ }
    vykresli();
    const sekce = $('pruvodce');
    if (sekce.getBoundingClientRect().top < 0) sekce.scrollIntoView({ block: 'start' });
    const prvni = $('pruvodceObsah').querySelector('input, select, button');
    if (prvni && krok !== 5) prvni.focus({ preventScroll: true });
  }
  function vykresliKroky() {
    document.querySelectorAll('#pruvodceKroky button').forEach(b => {
      const k = +b.dataset.krok;
      if (k === krok) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('hotovo', k !== krok && hotovo(k));
    });
    $('pruvZpet').disabled = krok === 1 && true;
    const p = P();
    $('pruvDal').textContent = krok === 5 ? '📊 Plná analýza →' : krok === 4 && kritIdx < p.kriteria.length - 1 ? 'Další kritérium →' : 'Další →';
    $('pruvStav').textContent = krok === 4 ? `kritérium ${kritIdx + 1} z ${p.kriteria.length}` : `krok ${krok} z 5`;
  }

  /* ---------- kroky ---------- */
  function krok1() {
    const p = P();
    return `<h2>${NADPISY[1]}</h2>
      <p class="pruv-uvod">Napište varianty, mezi kterými volíte (aspoň dvě). Můžete začít i ze šablony v horní liště – třeba koupě auta, výběr bydlení nebo zaměstnání.</p>
      <div class="pruv-seznam">${p.alternativy.map((a, i) => `<div class="pruv-radek">
        <input type="text" class="pa-nazev" data-i="${i}" value="${esc(a.nazev)}" maxlength="80" aria-label="Varianta ${i + 1}" placeholder="název varianty">
        <button type="button" class="ikona pa-smaz" data-i="${i}" aria-label="Odebrat ${esc(a.nazev)}" ${p.alternativy.length <= 1 ? 'disabled' : ''}>×</button></div>`).join('')}</div>
      <div class="tlacitka" style="margin-top:10px"><button type="button" class="pa-pridat">+ Přidat variantu</button>
        <button type="button" class="pr-novy">Začít úplně od začátku</button></div>
      <p class="napoveda">Tip: zahrňte i „nic neměnit“ (současný stav), pokud je to reálná možnost.</p>`;
  }
  function krok2() {
    const p = P(), T = UI.TYPY;
    const vst = x => (x === null ? '' : String(x).replace('.', ','));
    return `<h2>${NADPISY[2]}</h2>
      <p class="pruv-uvod">Kritéria jsou hlediska, podle kterých varianty porovnáváte. U každého určete, zda je lepší víc (↑), méně (↓), nebo ho ohodnotíte body 1–10 (★).
        Obvykle stačí 3–7 kritérií, která se nepřekrývají (např. ne „cena“ i „cena s DPH“).</p>
      <div class="pruv-seznam">${p.kriteria.map((k, j) => `<div class="pruv-krit" data-j="${j}">
        <input type="text" class="pk-nazev" value="${esc(k.nazev)}" maxlength="80" aria-label="Kritérium ${j + 1}" placeholder="např. Cena">
        <select class="pk-typ" aria-label="Směr kritéria ${esc(k.nazev)}">${Object.entries(T).map(([t, d]) => `<option value="${t}"${t === k.typ ? ' selected' : ''}>${d.znak} ${d.popis}</option>`).join('')}</select>
        <input type="text" class="pk-jedn jedn" value="${esc(k.jednotka)}" maxlength="20" placeholder="jednotka" aria-label="Jednotka" ${k.typ === 'subj' ? 'disabled' : ''}>
        <button type="button" class="ikona pk-smaz smaz" aria-label="Odebrat ${esc(k.nazev)}" ${p.kriteria.length <= 1 ? 'disabled' : ''}>×</button>
        <details${k.prahMin !== null || k.prahMax !== null ? ' open' : ''}><summary>Povinná podmínka (nepovinné)</summary>
          <div class="meze"><label>nejméně <input type="text" inputmode="decimal" class="pk-min" value="${esc(vst(k.prahMin))}" placeholder="—"></label>
          <label>nejvýše <input type="text" inputmode="decimal" class="pk-max" value="${esc(vst(k.prahMax))}" placeholder="—"></label></div>
          <span class="napoveda">Varianta mimo tyto meze se vyřadí bez ohledu na ostatní (např. rozpočet).</span></details>
      </div>`).join('')}</div>
      <div class="tlacitka" style="margin-top:10px"><button type="button" class="pk-pridat">+ Přidat kritérium</button></div>`;
  }
  function krok3() {
    return `<h2>${NADPISY[3]}</h2>
      <p class="pruv-uvod">Určete důležitost kritérií. Nevíte-li si rady, zvolte <b>Pořadí</b> – stačí kritéria seřadit. Pro přesnější výsledek použijte <b>Swing</b>,
        který bere ohled na to, jak moc se varianty v kritériu skutečně liší.</p>
      <div id="pruvVahy"></div>`;
  }
  function krok4() {
    const p = P();
    if (kritIdx >= p.kriteria.length) kritIdx = p.kriteria.length - 1;
    const j = kritIdx, k = p.kriteria[j], T = UI.TYPY;
    const smer = k.typ === 'max' ? 'čím víc, tím lépe' : k.typ === 'min' ? 'čím méně, tím lépe' : 'ohodnoťte body 1 (špatné) až 10 (výborné)';
    const radky = p.alternativy.map((a, i) => {
      if (k.typ === 'subj') {
        const v = a.hodnoty[j];
        return `<div class="hodn-radek"><span class="an">${esc(a.nazev)}</span><span class="napoveda" style="margin:0;text-align:right">${v ? v + ' / 10' : 'nevyplněno'}</span>
          <div class="subj-tlac" role="group" aria-label="${esc(a.nazev)} – ${esc(k.nazev)}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s =>
            `<button type="button" class="ph-subj" data-i="${i}" data-v="${s}" aria-pressed="${v === s}">${s}</button>`).join('')}</div></div>`;
      }
      return `<div class="hodn-radek"><label class="an" for="ph${i}">${esc(a.nazev)}</label>
        <input type="text" inputmode="decimal" id="ph${i}" class="ph-hodn${a.intervaly[j] ? ' interval' : ''}" data-i="${i}" value="${esc(UI.vstupText(i, j))}" placeholder="${k.jednotka ? esc(k.jednotka) : 'hodnota'}"></div>`;
    }).join('');
    return `<h2>${NADPISY[4]}</h2>
      <div class="hodnoceni-tecky" role="tablist" aria-label="Kritéria">${p.kriteria.map((x, q) =>
        `<button type="button" class="ph-krit${vyplnenoKrit(q) ? ' vyplneno' : ''}" data-q="${q}" aria-current="${q === j}" title="${esc(x.nazev)}" aria-label="${esc(x.nazev)}${vyplnenoKrit(q) ? ' (vyplněno)' : ''}">${q + 1}</button>`).join('')}</div>
      <div class="hodnoceni-hlava"><span class="kn">${T[k.typ].znak} ${esc(k.nazev)}${k.jednotka && k.typ !== 'subj' ? ` <span class="napoveda">[${esc(k.jednotka)}]</span>` : ''}</span>
        <span class="napoveda" style="margin:0">${smer}</span></div>
      ${radky}
      ${k.typ !== 'subj' ? '<p class="napoveda">Nejste si jistí? Zadejte rozpětí, např. <code>20–25</code> – výpočet použije střed a plná analýza z rozpětí odhadne, jak jistý je výsledek.</p>' : ''}`;
  }
  function krok5() {
    const st = S(), p = P();
    if (!st || !st.ok) {
      const chybi = p.kriteria.map((k, j) => (vyplnenoKrit(j) ? -1 : j)).filter(j => j >= 0);
      return `<h2>${NADPISY[5]}</h2><div class="upozorneni chyby"><b class="t">Zatím nelze vyhodnotit.</b> ${esc(st && (st.zprava || st.chybaMetody) || '')}
        ${chybi.length ? `<p style="margin:6px 0 0">Chybí hodnoty v kritériích: ${chybi.map(j => `<button type="button" class="male pv-skok" data-q="${j}">${esc(p.kriteria[j].nazev)}</button>`).join(' ')}</p>` : ''}</div>`;
    }
    const A = st.nazvyA, v = st.vysl;
    const viteze = st.serazeno.filter(q => st.por[q] === 1).map(q => A[q]);
    const vyr = st.elim.map((d, i) => (d.length ? `<li><b>${esc(p.alternativy[i].nazev)}</b> – ${esc(d.map(x => x.text).join('; '))}</li>` : '')).join('');
    const dom = st.dom.map((d, q) => (d.length ? `<li><b>${esc(A[q])}</b> – ${esc(d.map(z => A[z]).join(', '))} je ve všem stejně dobrá nebo lepší</li>` : '')).join('');
    return `<h2>${NADPISY[5]}</h2>
      <p class="napoveda" style="margin:0">Doporučení (${esc(UI.nazevMetody())}):</p>
      <div class="vysl-velky">🏆 ${esc(viteze.join(' = '))}</div>
      <div class="proc" id="pvProc">${UI.vysvetleni() ? '<b>Proč?</b> ' + esc(UI.vysvetleni()) : ''}</div>
      ${G.sloupce(st.serazeno.map(q => ({ nazev: A[q], hodnota: v.skore[q], znacka: st.por[q] + '.' })), { des: 3, min: p.metoda === 'promethee' ? -1 : 0, max: 1 })}
      ${vyr ? `<h3>Vyřazeno povinnou podmínkou</h3><ul class="napoveda" style="padding-left:18px">${vyr}</ul>` : ''}
      ${dom ? `<h3>Dominované varianty</h3><ul class="napoveda" style="padding-left:18px">${dom}</ul>` : ''}
      <p class="napoveda">Výsledek je jen tak dobrý jako zadané váhy a hodnoty. V plné analýze uvidíte, jak se pořadí mění s vahami (citlivost), jak jistý je výsledek
        při nejistých hodnotách (simulace) a co říkají jiné metody.</p>
      <div class="tlacitka"><button type="button" class="hlavni pv-plne">📊 Plná analýza</button><button type="button" class="pv-ulozit">Uložit projekt</button>
        <button type="button" class="pv-sdilet">🔗 Sdílet odkaz</button></div>`;
  }

  function vykresli() {
    if (UI.rezim() !== 'pruvodce') return;
    const o = $('pruvodceObsah');
    o.innerHTML = [null, krok1, krok2, krok3, krok4, krok5][krok]();
    if (krok === 3) UI.vykresliVahy($('pruvVahy'), { jenVahy: true });
    vykresliKroky();
  }

  /* ---------- události ---------- */
  function init() {
    $('pruvodceKroky').addEventListener('click', e => {
      const b = e.target.closest('[data-krok]'); if (!b) return;
      nastavKrok(+b.dataset.krok);
    });
    $('pruvZpet').addEventListener('click', () => {
      if (krok === 4 && kritIdx > 0) { kritIdx--; vykresli(); return; }
      if (krok === 5) kritIdx = P().kriteria.length - 1;
      nastavKrok(krok - 1);
    });
    $('pruvDal').addEventListener('click', () => {
      if (krok === 1 && !hotovo(1)) { Dialog.chyba('Zadejte aspoň dvě pojmenované varianty.'); return; }
      if (krok === 2 && !hotovo(2)) { Dialog.chyba('Každé kritérium potřebuje název.'); return; }
      if (krok === 3) kritIdx = 0;
      if (krok === 4 && kritIdx < P().kriteria.length - 1) { kritIdx++; vykresli(); const f = $('pruvodceObsah').querySelector('input,button.ph-subj'); if (f) f.focus({ preventScroll: true }); return; }
      if (krok === 5) { UI.prepniRezim('plne'); return; }
      nastavKrok(krok + 1);
    });
    const o = $('pruvodceObsah');
    o.addEventListener('input', e => {
      const t = e.target, p = P();
      if (t.classList.contains('pa-nazev')) { p.alternativy[+t.dataset.i].nazev = t.value; UI.zmena('hodnoty'); return; }
      const kr = t.closest('.pruv-krit');
      if (kr) {
        const k = p.kriteria[+kr.dataset.j];
        if (t.classList.contains('pk-nazev')) { k.nazev = t.value; UI.zmena('nazvy'); return; }
        if (t.classList.contains('pk-jedn')) { k.jednotka = t.value; UI.zmena('nazvy'); return; }
      }
      if (t.classList.contains('ph-hodn')) {
        const r = UI.nastavHodnotu(+t.dataset.i, kritIdx, t.value);
        t.classList.toggle('chyba', !!r.chyba);
        t.classList.toggle('interval', !!r.interval);
        UI.zmena('hodnoty');
        const b = o.querySelector(`.ph-krit[data-q="${kritIdx}"]`); if (b) b.classList.toggle('vyplneno', vyplnenoKrit(kritIdx));
      }
    });
    o.addEventListener('change', e => {
      const t = e.target, kr = t.closest('.pruv-krit');
      if (!kr) return;
      const j = +kr.dataset.j, k = P().kriteria[j];
      if (t.classList.contains('pk-typ')) { UI.zmenTyp(j, t.value); vykresli(); return; }
      if (t.classList.contains('pk-min') || t.classList.contains('pk-max')) {
        const v = J.parsujCislo(t.value);
        if (Number.isNaN(v)) { t.classList.add('chyba'); return; }
        t.classList.remove('chyba');
        k[t.classList.contains('pk-min') ? 'prahMin' : 'prahMax'] = v;
        UI.zmena('struktura');
      }
    });
    o.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const t = e.target;
      if (t.classList.contains('pa-nazev')) {
        e.preventDefault();
        const i = +t.dataset.i, p = P();
        if (i === p.alternativy.length - 1) { if (UI.pridejAlternativu('')) { vykresli(); fokus('.pa-nazev', p.alternativy.length - 1); } }
        else fokus('.pa-nazev', i + 1);
      } else if (t.classList.contains('pk-nazev')) {
        e.preventDefault();
        const j = +t.closest('.pruv-krit').dataset.j, p = P();
        if (j === p.kriteria.length - 1) { if (UI.pridejKriterium('')) { vykresli(); fokus('.pk-nazev', p.kriteria.length - 1); } }
        else fokus('.pk-nazev', j + 1);
      } else if (t.classList.contains('ph-hodn')) {
        e.preventDefault();
        const i = +t.dataset.i;
        if (i < P().alternativy.length - 1) fokus('.ph-hodn', i + 1); else $('pruvDal').click();
      }
    });
    o.addEventListener('click', async e => {
      const t = e.target, p = P();
      if (t.closest('.pa-pridat')) { if (UI.pridejAlternativu('')) { vykresli(); fokus('.pa-nazev', p.alternativy.length - 1); } return; }
      const sa = t.closest('.pa-smaz'); if (sa) { if (await UI.smazAlternativu(+sa.dataset.i)) vykresli(); return; }
      if (t.closest('.pr-novy')) { if (await Dialog.potvrd('Začít úplně od začátku? Současný projekt se nahradí prázdným (uložené projekty zůstanou).')) { UI.novy(); kritIdx = 0; nastavKrok(1); } return; }
      if (t.closest('.pk-pridat')) { if (UI.pridejKriterium('')) { vykresli(); fokus('.pk-nazev', p.kriteria.length - 1); } return; }
      const sk = t.closest('.pk-smaz'); if (sk) { if (await UI.smazKriterium(+sk.closest('.pruv-krit').dataset.j)) vykresli(); return; }
      const kb = t.closest('.ph-krit'); if (kb) { kritIdx = +kb.dataset.q; vykresli(); return; }
      const sb = t.closest('.ph-subj');
      if (sb) {
        const i = +sb.dataset.i;
        p.alternativy[i].hodnoty[kritIdx] = +sb.dataset.v;
        p.alternativy[i].intervaly[kritIdx] = null;
        UI.zmena('hodnoty');
        vykresli();
        const dalsi = o.querySelector(`.ph-subj[data-i="${i + 1}"][data-v="${sb.dataset.v}"]`) || o.querySelector(`.ph-subj[data-i="${i}"][data-v="${sb.dataset.v}"]`);
        if (dalsi) dalsi.focus({ preventScroll: true });
        return;
      }
      const sj = t.closest('.pv-skok'); if (sj) { kritIdx = +sj.dataset.q; nastavKrok(4); return; }
      if (t.closest('.pv-plne')) { UI.prepniRezim('plne'); return; }
      if (t.closest('.pv-ulozit')) { $('btnUlozit').click(); return; }
      if (t.closest('.pv-sdilet')) { $('btnSdilet').click(); }
    });
    UI.naZmenu((druh) => {
      if (UI.rezim() !== 'pruvodce') return;
      if (druh === 'nacteno' || druh === 'novy' || druh === 'rezim') { if (druh !== 'rezim') kritIdx = 0; vykresli(); return; }
      if (druh === 'struktura' && krok !== 3) { vykresli(); return; }
      if (krok === 5 && (druh === 'tezke' || druh === 'vahy' || druh === 'hodnoty')) {
        if (druh === 'tezke') { const el = $('pvProc'); if (el) el.innerHTML = UI.vysvetleni() ? '<b>Proč?</b> ' + esc(UI.vysvetleni()) : ''; }
        else vykresli();
        return;
      }
      vykresliKroky();
    });
  }
  function fokus(sel, i) { const el = $('pruvodceObsah').querySelectorAll(sel)[i]; if (el) { el.focus(); if (el.select) el.select(); } }

  init();
  window.RozhodovaniPruvodce = { krok: () => krok, nastavKrok, kritIdx: () => kritIdx };
})();
