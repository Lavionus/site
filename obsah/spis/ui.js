/* Stránka 📁 Spis případu – přehled, seznam záznamů po typech, hledání, karty, správa případů, balíček. */
(function () {
  'use strict';
  const S = window.SPIS, el = S.el, T = S.TYPY, $ = id => document.getElementById(id);
  const NASTROJ = 'spis';
  let filtrTyp = '', zalozka = 'seznam', pripad = null;
  const chyba = e => Dialog.chyba(e && e.message ? e.message : String(e));

  /* ---------- vykreslení ---------- */
  let cekaRender = null, poradi = 0;
  function render() { clearTimeout(cekaRender); cekaRender = setTimeout(vykresli, 30); }
  // vykreslení je async – starší běh, který předběhl novější (rychlé změny, import), už nic nevypíše
  async function vykresli() {
    const moje = ++poradi, aktualni = () => moje === poradi;
    try {
      const id = S.aktivni();
      pripad = id ? await S.pripad(id) : null;
      $('chybaUloziste').hidden = true;
    } catch (e) {
      $('chybaUloziste').textContent = e.message;
      $('chybaUloziste').hidden = false;
      $('uvod').hidden = $('prehled').hidden = true;
      document.querySelectorAll('[data-prikaz]').forEach(b => { if (b.dataset.prikaz !== 'napoveda') b.disabled = true; });
      return;
    }
    $('uvod').hidden = !!pripad;
    $('prehled').hidden = !pripad;
    document.querySelectorAll('[data-potrebuje-pripad], [data-nabidka=nabPridat]').forEach(b => { b.disabled = !pripad; });
    if (!pripad) return;
    $('pNazev').textContent = pripad.nazev;
    $('pCislo').textContent = pripad.cislo || '';
    $('pPopis').textContent = pripad.popis || '';
    $('pPopis').hidden = !pripad.popis;

    const vsechny = await S.seznam(null, { smazane: $('smazane').checked });
    const sh = await S.souhrn();
    if (!aktualni()) return;
    // dlaždice = souhrn počtů a zároveň záložky typů
    const dl = $('dlazdice');
    dl.replaceChildren(
      el('button', { type: 'button', 'aria-pressed': String(zalozka === 'seznam' && !filtrTyp), dataset: { typ: '' } }, el('b', { text: sh.celkem }), el('span', { text: '🗂️ Vše' })),
      ...Object.entries(T).map(([k, t]) => el('button', { type: 'button', 'aria-pressed': String(zalozka === 'seznam' && filtrTyp === k), dataset: { typ: k } }, el('b', { text: sh.entity[k] }), el('span', { text: t.ikona + ' ' + t.mnoz }))),
      el('button', { type: 'button', 'aria-pressed': String(zalozka === 'vazby'), dataset: { zal: 'vazby' } }, el('b', { text: sh.vazby }), el('span', { text: '🔗 Vazby' })),
      el('button', { type: 'button', 'aria-pressed': String(zalozka === 'historie'), dataset: { zal: 'historie' } }, el('b', { text: '🕓' }), el('span', { text: 'Historie' })));
    if (S.poskozenych) { $('varovani').textContent = 'Některé záznamy v úložišti jsou poškozené (' + S.poskozenych + ') a byly přeskočeny.'; $('varovani').hidden = false; }

    $('seznam').hidden = zalozka === 'historie';
    $('historie').hidden = zalozka !== 'historie';
    $('hledat').parentNode.hidden = zalozka === 'historie';
    if (zalozka === 'historie') return vykresliHistorii(aktualni);
    const hledat = $('hledat').value.trim();
    if (zalozka === 'vazby') return vykresliVazby(vsechny, hledat, aktualni);

    const polozky = await S.seznam(filtrTyp || null, { hledat, smazane: $('smazane').checked });
    const vz = await S.vazby(null, { pripad: pripad.id });
    if (!aktualni()) return;
    const sez = $('seznam');
    sez.replaceChildren();
    const pocet = new Map();      // počet vazeb entity (jedním průchodem – na velkém spisu ne n × m)
    for (const v of vz) for (const x of [v.od, v.do]) pocet.set(x, (pocet.get(x) || 0) + 1);
    for (const e of polozky) {
      const n = pocet.get(e.id) || 0;
      sez.append(el('button', { type: 'button', class: 'karta' + (e.smazano ? ' smazana' : ''), dataset: { id: e.id } },
        el('span', { class: 'ik', text: T[e.typ].ikona, title: T[e.typ].nazev }),
        el('span', { class: 'tx' }, el('div', { class: 'nz', 'data-i18n': 'ne', text: e.nazev }),
          el('div', { class: 'po', 'data-i18n': 'ne', text: podtitul(e) }),
          n ? el('div', { class: 'vz', text: '🔗 ' + n }) : null)));
    }
    if (!polozky.length) sez.append(el('div', { class: 'prazdne', text: hledat ? 'Nic neodpovídá hledání.' : 'Zatím žádné záznamy – přidejte je tlačítkem ➕ Přidat.' }));
  }

  // krátký popis pod názvem podle typu
  function podtitul(e) {
    const d = e.data;
    const casti = {
      osoba: [d.role, d.vyska ? d.vyska + ' cm' : ''], stopa: [d.cislo ? 'č. ' + d.cislo : '', d.druh, S.formatCas(d.kdy)],
      misto: [d.adresa, d.lat !== undefined ? d.lat + ', ' + d.lon : ''], udalost: [S.formatCas(d.kdy) + (d.do ? ' – ' + S.formatCas(d.do).replace(/^.* /, '') : '')],
      foto: [d.popis], dokument: [d.druh], vozidlo: [d.rz], telefon: [d.cislo], ucet: [d.cislo, d.banka]
    }[e.typ] || [];
    return casti.filter(Boolean).join(' · ');
  }

  async function vykresliVazby(vsechny, hledat, aktualni) {
    const jmeno = Object.fromEntries(vsechny.map(e => [e.id, T[e.typ].ikona + ' ' + e.nazev]));
    const h = hledat.toLowerCase();
    const vz = (await S.vazby(null, { pripad: pripad.id, smazane: $('smazane').checked }))
      .filter(v => !h || ((jmeno[v.od] || '') + ' ' + (jmeno[v.do] || '') + ' ' + (v.popis || '') + ' ' + S.nazevVazby(v.typ)).toLowerCase().includes(h));
    if (!aktualni()) return;
    const sez = $('seznam');
    sez.replaceChildren();
    for (const v of vz) {
      sez.append(el('button', { type: 'button', class: 'karta' + (v.smazano ? ' smazana' : ''), dataset: { id: v.od } },
        el('span', { class: 'ik', text: '🔗' }),
        el('span', { class: 'tx' },
          el('div', { class: 'nz' }, el('span', { 'data-i18n': 'ne', text: jmeno[v.od] || v.od }), el('span', { text: ' → ' + S.nazevVazby(v.typ) + ' → ' }), el('span', { 'data-i18n': 'ne', text: jmeno[v.do] || v.do })),
          el('div', { class: 'po', 'data-i18n': 'ne', text: [v.kdy ? S.formatCas(v.kdy) : '', v.popis].filter(Boolean).join(' · ') }))));
    }
    if (!vz.length) sez.append(el('div', { class: 'prazdne', text: 'Zatím žádné vazby – přidejte je na kartě záznamu.' }));
  }

  async function vykresliHistorii(aktualni) {
    const hi = (await S.historie(null, { pripad: pripad.id })).slice(0, 300);
    const nazvy = Object.fromEntries((await S.seznam(null, { smazane: true })).map(e => [e.id, T[e.typ].ikona + ' ' + e.nazev]));
    if (!aktualni()) return;
    const AKCE = { zalozeno: 'založeno', zmena: 'změna', smazano: 'smazáno', obnoveno: 'obnoveno', import: 'import balíčku' };
    $('historie').replaceChildren(...hi.map(h => el('li', {},
      el('span', { class: 'kdy', 'data-i18n': 'ne', text: S.formatCas(h.kdy) + ' · ' + (h.nastroj || '') }), ' ',
      el('b', { text: AKCE[h.akce] || h.akce }), ' ',
      nazvy[h.entita] ? el('button', { type: 'button', class: 'odkaz', 'data-i18n': 'ne', text: nazvy[h.entita], onclick: () => SpisKarta.otevri(h.entita, { nastroj: NASTROJ }) })
        : el('span', { 'data-i18n': 'ne', text: h.entita === pripad.id ? '' : (h.zmeny && Array.isArray(h.zmeny.typ) ? '🔗 ' + S.nazevVazby(String(h.zmeny.typ[1] || '')) : '') }),
      h.zmeny && h.akce === 'zmena' ? el('span', { class: 'kdy', 'data-i18n': 'ne', text: ' (' + Object.keys(h.zmeny).join(', ') + ')' }) : null)));
    if (!hi.length) $('historie').append(el('li', { class: 'prazdne', text: 'Historie je prázdná.' }));
  }

  /* ---------- případy ---------- */
  function formularPripadu(p) {
    $('pripadNadpis').textContent = p ? 'Údaje případu' : 'Nový případ';
    $('fNazev').value = p ? p.nazev : '';
    $('fCislo').value = p ? p.cislo || '' : '';
    $('fPopis').value = p ? p.popis || '' : '';
    $('fChyba').textContent = '';
    const d = $('dlgPripad');
    d.showModal();
    $('fNazev').focus();
    return new Promise(hotovo => {
      const f = $('formPripad');
      const odeslat = async ev => {
        if (ev.submitter && ev.submitter.value !== 'ok') return;   // Zrušit zavře dialog sám
        ev.preventDefault();
        const udaje = { nazev: $('fNazev').value, cislo: $('fCislo').value, popis: $('fPopis').value };
        try {
          const r = p ? await S.ulozPripad(Object.assign({ id: p.id }, udaje), { nastroj: NASTROJ }) : await S.zalozPripad(udaje, { nastroj: NASTROJ });
          f.removeEventListener('submit', odeslat);
          d.close();
          hotovo(r);
        } catch (e) { $('fChyba').textContent = e.message; }
      };
      f.addEventListener('submit', odeslat);
      d.addEventListener('close', () => { f.removeEventListener('submit', odeslat); hotovo(null); }, { once: true });
    });
  }

  function stahni(text, jmeno) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: jmeno });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'pripad';

  function souhrnImportu(r) {
    const t = $('importTelo');
    t.replaceChildren(
      el('p', {}, 'Případ ', el('b', { 'data-i18n': 'ne', text: r.nazev }), ' byl sloučen s tímto prohlížečem.'),
      el('ul', {},
        el('li', { text: 'Nových záznamů: ' + r.nove }),
        el('li', { text: 'Aktualizovaných (novější ze souboru): ' + r.aktualizovane }),
        el('li', { text: 'Ponechaných (novější je tady): ' + r.ponechane }),
        el('li', { text: 'Beze změny: ' + r.stejne })));
    if (r.konflikty.length) {
      t.append(el('h3', { text: '⚠️ Konflikty: ' + r.konflikty.length }),
        el('p', { class: 'chyba-text', text: 'Tyto záznamy byly změněny na obou místech nezávisle. Zůstala novější verze – starší je v historii záznamu.' }),
        el('div', { class: 'tab-wrap' }, el('table', { class: 'tab' },
          el('thead', {}, el('tr', {}, el('th', { text: 'Záznam' }), el('th', { text: 'Tady upraveno' }), el('th', { text: 'V souboru upraveno' }), el('th', { text: 'Ponecháno' }))),
          el('tbody', {}, r.konflikty.map(k => el('tr', {}, el('td', { 'data-i18n': 'ne', text: k.nazev }), el('td', { 'data-i18n': 'ne', text: S.formatCas(k.mistni) }),
            el('td', { 'data-i18n': 'ne', text: S.formatCas(k.soubor) }), el('td', { text: k.vyhral === 'soubor' ? 'ze souboru' : 'místní' })))))));
    } else t.append(el('p', { class: 'ok-text', text: '✓ Bez konfliktů.' }));
    if (r.vynechane.length) {
      t.append(el('h3', { text: 'Vynechané neplatné záznamy: ' + r.vynechane.length }),
        el('p', { class: 'chyba-text', text: 'Soubor obsahuje záznamy, které neprošly kontrolou (poškozené nebo podvržené). Nebyly importovány.' }),
        el('ul', {}, r.vynechane.slice(0, 50).map(v => el('li', {}, el('span', { text: v.druh + ' ' }), el('code', { 'data-i18n': 'ne', text: v.id }), el('span', { 'data-i18n': 'ne', text: ' – ' + v.duvod })))));
    }
    $('dlgImport').showModal();
  }

  const PRIKAZY = {
    async novyPripad() { const p = await formularPripadu(null); if (p) await S.otevri(p.id); return p; },
    async upravitPripad() { if (pripad) await formularPripadu(pripad); },
    async smazatPripad() {
      if (!pripad) return;
      const n = (await S.souhrn()).celkem;
      if (!(await Dialog.potvrd(`Natrvalo smazat případ „${pripad.nazev}“ včetně ${n} záznamů, vazeb, historie a souborů? Nejde vrátit – pokud si nejste jistí, nejdřív exportujte balíček.`, { ok: 'Smazat natrvalo' }))) return;
      try { await S.smazPripad(pripad.id); Dialog.info('Případ smazán.'); } catch (e) { chyba(e); }
    },
    async modelovy(tise) {
      try {
        const r = await S.zalozModelovy(window.MODELOVY_PRIPAD, { nastroj: 'modelovy-pripad' });
        await S.otevri(r.pripad);
        if (tise !== true) Dialog.info(r.pridano ? 'Modelový případ 17/2026 založen (' + r.pridano + ' záznamů a vazeb).' : 'Modelový případ už existuje – otevřen beze změn.');
      } catch (e) { chyba(e); }
    },
    async export() {
      if (!pripad) return;
      try {
        const text = await S.exportuj(pripad.id);
        stahni(text, 'spis-' + slug(pripad.cislo || pripad.nazev) + '-' + new Date().toISOString().slice(0, 10) + '.json');
        Dialog.info('Balíček spisu exportován. Přeneste soubor na druhé zařízení a tam ho importujte.');
        return text;
      } catch (e) { chyba(e); }
    },
    import() { $('soubor').click(); },
    async importText(text) {
      try {
        const r = await S.importuj(text, { nastroj: NASTROJ });
        await S.otevri(r.pripad);
        souhrnImportu(r);
        return r;
      } catch (e) { chyba(e); }
    },
    napoveda() { $('dlgNapoveda').showModal(); },
    async nova(typ) {
      if (!pripad) return;
      const e = await SpisKarta.uprav({ typ }, { nastroj: NASTROJ });
      if (e) SpisKarta.otevri(e.id, { nastroj: NASTROJ });
    }
  };

  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 1024 * 1024 * 1024) return Dialog.chyba('Soubor je větší než 1 GB – to není balíček spisu.');
    PRIKAZY.importText(await f.text());
  });

  /* ---------- lišta a nabídky (vzor prompty.html) ---------- */
  $('nabPridat').append(...Object.entries(T).map(([k, t]) => el('button', { type: 'button', class: 'tl', dataset: { prikaz: 'nova', typ: k } }, t.ikona + ' ' + t.nazev)));
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
    if (b && !b.disabled) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](b.dataset.typ); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    const k = e.target.closest('#seznam .karta');
    if (k) return SpisKarta.otevri(k.dataset.id, { nastroj: NASTROJ });
    const d = e.target.closest('#dlazdice button');
    if (d) {
      if (d.dataset.zal) { zalozka = d.dataset.zal; filtrTyp = ''; } else { zalozka = 'seznam'; filtrTyp = d.dataset.typ; }
      render();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });
  addEventListener('resize', zavriNabidky);
  document.querySelectorAll('[data-zavrit]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('hledat').addEventListener('input', render);
  $('smazane').addEventListener('change', render);

  // synchronizace: změny z jiných záložek i z karty/výběru na této stránce
  S.odebirej(u => { if (u.druh === 'aktivni' || u.druh === 'pripad' || !pripad || u.pripad === pripad.id) render(); });
  addEventListener('storage', e => { if (e.key === S.KLIC_AKTIVNI) render(); });

  SpisVyber.vloz($('vyberMisto'), { nastroj: NASTROJ, bezOdkazu: true, novy: () => formularPripadu(null) });
  render();
  // průvodce modelovým případem (?pripad=17): založit/otevřít modelový spis bez dotazu
  if (window.ModelovyPripad && window.ModelovyPripad.aktivni) PRIKAZY.modelovy(true);
  window.SPIS_APP = { PRIKAZY, render: vykresli };
})();
