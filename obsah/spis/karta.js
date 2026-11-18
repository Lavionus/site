/* Sdílená karta entity spisu (dialog) – hlavní údaje podle typu, vazby, historie změn, úprava a smazání.
   Použití (potřebuje ../dialog.js a spis/jadro.js):
     SpisKarta.otevri(id, { nastroj: 'fotodokumentace' })   – karta existující entity
     await SpisKarta.uprav({ typ: 'stopa' } | entita, { nastroj })  – formulář; vrátí uloženou entitu nebo null
   Data uživatele mají data-i18n="ne" a vkládají se jen přes textContent. */
(function () {
  'use strict';
  const S = window.SPIS, el = S.el, T = S.TYPY;
  const AKCE = { zalozeno: 'založeno', zmena: 'změna', smazano: 'smazáno', obnoveno: 'obnoveno', import: 'import balíčku' };
  const ne = (tag, text, atr) => el(tag, Object.assign({ 'data-i18n': 'ne', text: text == null ? '' : String(text) }, atr || {}));
  const velikost = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' kB' : (b / 1048576).toFixed(1) + ' MB';
  const zobrazHodnotu = v => v === null || v === undefined ? '–' : typeof v === 'object' ? JSON.stringify(v) : String(v);

  function styl() {
    if (document.getElementById('spis-karta-styl')) return;
    const st = el('style', { id: 'spis-karta-styl' });
    st.textContent = `
.sk-okno{margin:auto;border:1px solid var(--border);border-radius:10px;padding:0;background:var(--bg-elevated);color:var(--text);width:min(96vw,720px);max-height:92vh;box-shadow:var(--shadow);font-size:.88rem}
.sk-okno::backdrop{background:rgba(0,0,0,.5)}
.sk-hlava{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-elevated);z-index:1}
.sk-hlava h2{font-size:1rem;flex:1;min-width:0;overflow-wrap:anywhere}
.sk-telo{padding:6px 14px 14px}
.sk-pata{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;border-top:1px solid var(--border);position:sticky;bottom:0;background:var(--bg-elevated)}
.sk-pata .sk-vpravo{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.sk-okno h3{font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);margin:14px 0 4px}
.sk-tl{background:var(--bg-control);color:var(--text);border:1px solid var(--border);padding:5px 10px;border-radius:6px;cursor:pointer;font:inherit;font-size:.84rem;white-space:nowrap}
.sk-tl:hover{background:var(--bg-hover);border-color:var(--border-strong)}
.sk-tl:focus-visible,.sk-vstup:focus{outline:2px solid var(--accent);outline-offset:1px}
.sk-tl.hlavni{background:var(--accent);color:var(--on-accent,#fff);border-color:var(--accent);font-weight:600}
.sk-tl.nebezpecne{color:var(--danger)}
.sk-tl.mini{padding:1px 7px;font-size:.78rem}
.sk-odkaz{background:none;border:0;color:var(--accent);cursor:pointer;font:inherit;padding:0;text-align:left;text-decoration:underline;text-underline-offset:2px}
.sk-udaje{display:grid;grid-template-columns:minmax(90px,max-content) 1fr;gap:4px 12px;margin-top:6px}
.sk-udaje dt{color:var(--text-faint);font-size:.78rem;padding-top:2px}
.sk-udaje dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.sk-mono{font-family:ui-monospace,monospace;font-size:.78rem;word-break:break-all}
.sk-znak{display:inline-block;border-radius:10px;padding:1px 8px;font-size:.72rem;border:1px solid var(--border);background:var(--bg-control);margin-right:4px}
.sk-znak.smaz{color:var(--danger);border-color:var(--danger)}
.sk-seznam{list-style:none;padding:0;margin:0}
.sk-seznam li{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid var(--border)}
.sk-seznam li > .sk-text{flex:1;min-width:0;overflow-wrap:anywhere}
.sk-mala{font-size:.76rem;color:var(--text-faint)}
.sk-smazany{text-decoration:line-through;color:var(--text-faint)}
.sk-nahled{max-width:100%;max-height:260px;border-radius:6px;border:1px solid var(--border);display:block;margin-top:4px}
.sk-form label{display:block;font-size:.76rem;color:var(--text-faint);margin:9px 0 3px}
.sk-vstup{width:100%;background:var(--bg-input);border:1px solid var(--border-strong);border-radius:6px;color:var(--text);padding:7px 10px;font:inherit;font-size:.88rem}
textarea.sk-vstup{resize:vertical;min-height:60px}
.sk-mrizka{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:0 12px}
.sk-zaskrt{display:flex;flex-wrap:wrap;gap:4px 14px;max-height:160px;overflow-y:auto;padding:4px 0}
.sk-zaskrt label{display:flex;gap:5px;align-items:center;margin:0;font-size:.84rem;color:var(--text)}
.sk-chyby{color:var(--danger);margin-top:8px;font-size:.84rem}
.sk-nova-vazba{background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;padding:2px 10px 10px;margin-top:8px}
.sk-okno details summary{cursor:pointer;color:var(--accent);font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 4px}`;
    document.head.appendChild(st);
  }

  let dlg = null, hlava, telo, pata;
  function okno() {
    styl();
    if (!dlg) {
      dlg = el('dialog', { class: 'sk-okno', 'aria-labelledby': 'sk-nadpis' });
      hlava = el('div', { class: 'sk-hlava' }); telo = el('div', { class: 'sk-telo' }); pata = el('div', { class: 'sk-pata' });
      dlg.append(hlava, telo, pata);
      document.body.append(dlg);
    }
    return dlg;
  }
  function kostra(nadpisIkona, nadpisText, data) {
    okno();
    hlava.replaceChildren(el('h2', { id: 'sk-nadpis' }, nadpisIkona + ' ', data ? ne('span', nadpisText) : nadpisText),
      el('button', { type: 'button', class: 'sk-tl mini', title: 'Zavřít', 'aria-label': 'Zavřít', onclick: () => dlg.close() }, '✕'));
    telo.replaceChildren(); pata.replaceChildren();
    if (!dlg.open) dlg.showModal();
  }
  const chyba = e => { if (window.Dialog) Dialog.chyba(e.message || String(e)); else console.error(e); };

  /* ---------- karta ---------- */
  async function otevri(id, volby = {}) {
    let e;
    try { e = await S.entita(id); } catch (x) { return chyba(x); }
    if (!e) return chyba(new Error('Záznam neexistuje nebo je poškozený.'));
    const typ = T[e.typ];
    kostra(typ.ikona, e.nazev, true);
    telo.append(el('div', {}, el('span', { class: 'sk-znak', text: typ.nazev }), e.smazano ? el('span', { class: 'sk-znak smaz', text: 'smazáno' }) : null));

    // hlavní údaje podle typu
    const dl = el('dl', { class: 'sk-udaje' });
    const znamá = new Set();
    for (const p of typ.pole) {
      znamá.add(p.k);
      const v = e.data[p.k];
      if (v === undefined) continue;
      let dd;
      if (p.d === 'entita' || p.d === 'entity') {
        dd = el('dd');
        for (const rid of [].concat(v)) {
          const r = await S.entita(rid);
          dd.append(r ? el('button', { type: 'button', class: 'sk-odkaz' + (r.smazano ? ' sk-smazany' : ''), 'data-i18n': 'ne', text: r.nazev, onclick: () => otevri(rid, volby) }) : ne('span', rid, { class: 'sk-mala' }), ' ');
        }
      } else if (p.d === 'soubor') {
        dd = el('dd');
        const s = await S.soubor(v).catch(() => null);
        if (!s) dd.append(el('span', { class: 'sk-mala', text: 'soubor chybí' }));
        else {
          const url = URL.createObjectURL(s.blob);
          dlg.addEventListener('close', () => URL.revokeObjectURL(url), { once: true });
          dd.append(ne('span', s.nazev), el('span', { class: 'sk-mala', text: ' · ' + velikost(s.velikost) + ' · ' }), el('a', { href: url, download: s.nazev, class: 'sk-odkaz', text: 'stáhnout' }));
          if (/^image\/(jpeg|png|webp|gif)$/.test(s.mime)) dd.append(el('img', { src: url, alt: '', class: 'sk-nahled' }));
        }
      } else {
        const text = p.d === 'cas' ? S.formatCas(v) : p.d === 'vyber' ? (p.moz.find(m => m[0] === v) || [v, v])[1] : String(v);
        dd = p.d === 'vyber' ? el('dd', { text }) : ne('dd', text, p.d === 'sha256' ? { class: 'sk-mono' } : null);
      }
      dl.append(el('dt', { text: p.n }), dd);
    }
    // pole doplněná jinými nástroji (zatím bez vlastního zobrazení)
    for (const [k, v] of Object.entries(e.data)) if (!znamá.has(k)) dl.append(ne('dt', k), ne('dd', zobrazHodnotu(v), { class: 'sk-mono' }));
    telo.append(dl);
    telo.append(el('div', { class: 'sk-mala', style: 'margin-top:8px' }, 'Zdroj: ', ne('span', e.zdroj || '–'), ' · vytvořeno ', ne('span', S.formatCas(e.vytvoreno)), ' · upraveno ', ne('span', S.formatCas(e.upraveno))));

    // vazby
    const vz = await S.vazby(id);
    telo.append(el('h3', { text: 'Vazby (' + vz.length + ')' }));
    const ul = el('ul', { class: 'sk-seznam' });
    for (const v of vz) {
      const jine = v.od === id ? v.do : v.od, r = await S.entita(jine);
      ul.append(el('li', { 'data-vazba': v.id },
        el('span', { class: 'sk-text' },
          el('span', { class: 'sk-znak', text: (v.od === id ? '→ ' : '← ') + S.nazevVazby(v.typ) }),
          r ? el('button', { type: 'button', class: 'sk-odkaz' + (r.smazano ? ' sk-smazany' : ''), 'data-i18n': 'ne', text: (T[r.typ] ? T[r.typ].ikona + ' ' : '') + r.nazev, onclick: () => otevri(jine, volby) }) : ne('span', jine, { class: 'sk-mala' }),
          v.kdy ? ne('span', ' · ' + S.formatCas(v.kdy), { class: 'sk-mala' }) : null,
          v.popis ? ne('span', ' · ' + v.popis, { class: 'sk-mala' }) : null),
        el('button', { type: 'button', class: 'sk-tl mini nebezpecne', title: 'Odebrat vazbu', 'aria-label': 'Odebrat vazbu', 'data-odebrat': v.id, onclick: async () => {
          if (!(await Dialog.potvrd('Odebrat tuto vazbu? Zůstane v historii.', { ok: 'Odebrat' }))) return;
          try { await S.smaz(v.id, { nastroj: volby.nastroj }); otevri(id, volby); } catch (x) { chyba(x); }
        } }, '✕')));
    }
    if (!vz.length) ul.append(el('li', { class: 'sk-mala', text: 'Zatím žádné vazby.' }));
    telo.append(ul);
    if (!e.smazano) telo.append(await formularVazby(e, volby));

    // historie
    const hi = await S.historie(id);
    const det = el('details', {}, el('summary', { text: 'Historie změn (' + hi.length + ')' }));
    const hul = el('ul', { class: 'sk-seznam' });
    for (const h of hi) {
      const zm = Object.entries(h.zmeny || {}).map(([k, [a, b]]) => {
        const p = typ.pole.find(x => x.k === k);
        return el('div', { class: 'sk-mala' }, el('span', { text: p ? p.n : k === 'nazev' ? typ.jmeno : k }), ': ', ne('span', zobrazHodnotu(a)), ' → ', ne('span', zobrazHodnotu(b)));
      });
      hul.append(el('li', {}, el('span', { class: 'sk-text' }, ne('span', S.formatCas(h.kdy)), ' · ', el('b', { text: AKCE[h.akce] || h.akce }), ' · ', ne('span', h.nastroj || ''), ...zm)));
    }
    det.append(hul);
    telo.append(det);

    // tlačítka
    pata.append(e.smazano
      ? el('button', { type: 'button', class: 'sk-tl', onclick: async () => { try { await S.obnov(id, { nastroj: volby.nastroj }); otevri(id, volby); } catch (x) { chyba(x); } } }, '♻️ Obnovit')
      : el('button', { type: 'button', class: 'sk-tl nebezpecne', 'data-akce': 'smazat', onclick: async () => {
        if (!(await Dialog.potvrd('Smazat záznam? Zůstane v historii a jde obnovit (zobrazit smazané).', { ok: 'Smazat' }))) return;
        try { await S.smaz(id, { nastroj: volby.nastroj }); otevri(id, volby); } catch (x) { chyba(x); }
      } }, '🗑️ Smazat'),
    el('div', { class: 'sk-vpravo' },
      el('button', { type: 'button', class: 'sk-tl', onclick: () => dlg.close() }, 'Zavřít'),
      e.smazano ? null : el('button', { type: 'button', class: 'sk-tl hlavni', 'data-akce': 'upravit', onclick: async () => { if (await uprav(e, volby)) otevri(id, volby); } }, '✏️ Upravit')));
  }

  // přidání vazby z karty: typ + cílová entita + popis + čas
  async function formularVazby(e, volby) {
    const ostatni = (await S.seznam(null, { pripad: e.pripad })).filter(x => x.id !== e.id);
    const selTyp = el('select', { class: 'sk-vstup', id: 'skVazbaTyp' }, S.VAZBY.map(([k, n]) => el('option', { value: k, text: n })));
    const selCil = el('select', { class: 'sk-vstup', id: 'skVazbaCil' }, el('option', { value: '', text: '– vyberte záznam –' }));
    for (const [t, d] of Object.entries(T)) {
      const sk = ostatni.filter(x => x.typ === t);
      if (sk.length) selCil.append(el('optgroup', { label: d.mnoz }, sk.map(x => ne('option', x.nazev, { value: x.id }))));
    }
    const popis = el('input', { class: 'sk-vstup', id: 'skVazbaPopis', placeholder: 'např. délka hovoru, částka' });
    const kdy = el('input', { class: 'sk-vstup', id: 'skVazbaKdy', type: 'datetime-local' });
    const smer = el('select', { class: 'sk-vstup', id: 'skVazbaSmer' }, el('option', { value: 'z', text: 'z tohoto záznamu →' }), el('option', { value: 'do', text: '← do tohoto záznamu' }));
    const box = el('div', { class: 'sk-nova-vazba sk-form' },
      el('div', { class: 'sk-mrizka' },
        el('div', {}, el('label', { for: 'skVazbaTyp', text: 'Typ vazby' }), selTyp),
        el('div', {}, el('label', { for: 'skVazbaSmer', text: 'Směr' }), smer),
        el('div', {}, el('label', { for: 'skVazbaCil', text: 'Druhý záznam' }), selCil),
        el('div', {}, el('label', { for: 'skVazbaKdy', text: 'Kdy (nepovinné)' }), kdy)),
      el('label', { for: 'skVazbaPopis', text: 'Popis (nepovinné)' }), popis,
      el('button', { type: 'button', class: 'sk-tl', style: 'margin-top:8px', id: 'skVazbaPridat', disabled: !ostatni.length, onclick: async () => {
        if (!selCil.value) return Dialog.chyba('Vyberte druhý záznam vazby.');
        const [od, doId] = smer.value === 'z' ? [e.id, selCil.value] : [selCil.value, e.id];
        try { await S.vazba(od, doId, selTyp.value, { popis: popis.value, kdy: kdy.value || undefined, nastroj: volby.nastroj }); otevri(e.id, volby); }
        catch (x) { chyba(x); }
      } }, '🔗 Přidat vazbu'));
    return el('details', { class: 'sk-nova' }, el('summary', { text: 'Přidat vazbu' }), ostatni.length ? box : el('div', { class: 'sk-mala', text: 'Případ zatím nemá další záznamy, se kterými by šlo vazbu vytvořit.' }));
  }

  /* ---------- formulář (nová / úprava) ---------- */
  function uprav(vstup, volby = {}) {
    const typ = T[vstup.typ];
    if (!typ) return Promise.resolve(null);
    const puvodni = vstup.id ? vstup : null, data = Object.assign({}, vstup.data || {});
    kostra(typ.ikona, (puvodni ? 'Upravit: ' : 'Nový záznam: ') + typ.nazev.toLowerCase(), false);
    return new Promise(async hotovo => {
      let vysledek = null;
      dlg.addEventListener('close', () => hotovo(vysledek), { once: true });
      const form = el('form', { class: 'sk-form', id: 'skForm', novalidate: true });
      const vstupy = {};
      form.append(el('label', { for: 'sk-nazev', text: typ.jmeno + ' *' }), vstupy.nazev = el('input', { class: 'sk-vstup', id: 'sk-nazev', name: 'nazev', maxlength: 300, value: puvodni ? puvodni.nazev : '', required: true }));
      const mriz = el('div', { class: 'sk-mrizka' }), dlouhe = [];
      for (const p of typ.pole) {
        const id = 'sk-p-' + p.k, v = data[p.k];
        let pole;
        if (p.d === 'dlouhy') { pole = el('textarea', { class: 'sk-vstup', id, rows: 3 }); pole.value = v || ''; }
        else if (p.d === 'vyber') pole = el('select', { class: 'sk-vstup', id }, el('option', { value: '', text: '– neurčeno –' }), p.moz.map(([k, n]) => el('option', { value: k, text: n, selected: v === k })));
        else if (p.d === 'entita' || p.d === 'entity') {
          const kand = await S.seznam(null, { pripad: (puvodni && puvodni.pripad) || undefined, fn: x => p.typy.includes(x.typ) });
          if (p.d === 'entita') pole = el('select', { class: 'sk-vstup', id }, el('option', { value: '', text: '– žádné –' }), kand.map(x => ne('option', x.nazev, { value: x.id, selected: v === x.id })));
          else pole = el('div', { class: 'sk-zaskrt', id }, kand.length ? kand.map(x => el('label', {}, el('input', { type: 'checkbox', value: x.id, checked: (v || []).includes(x.id) }), ne('span', x.nazev)))
            : el('span', { class: 'sk-mala', text: 'Případ zatím nemá žádné záznamy tohoto typu.' }));
        } else if (p.d === 'soubor') {
          pole = el('input', { class: 'sk-vstup', id, type: 'file', accept: vstup.typ === 'foto' ? 'image/*' : null });
          if (v) pole.title = 'Nový soubor nahradí uložený';
        } else {
          pole = el('input', { class: 'sk-vstup' + (p.d === 'sha256' ? ' sk-mono' : ''), id, type: p.d === 'cas' ? 'datetime-local' : p.d === 'cislo' ? 'number' : 'text', step: p.d === 'cislo' ? 'any' : null,
            list: p.nab ? id + '-nab' : null, spellcheck: p.d === 'sha256' ? 'false' : null, placeholder: p.d === 'sha256' ? '64 šestnáctkových znaků' : null });
          pole.value = v === undefined ? '' : p.d === 'cas' ? String(v).slice(0, 16) : String(v);
        }
        vstupy[p.k] = pole;
        const obal = el('div', {}, el('label', { for: id, text: p.n + (p.povinne ? ' *' : '') }), pole, p.nab ? el('datalist', { id: id + '-nab' }, p.nab.map(n => el('option', { value: n }))) : null);
        if (p.d === 'dlouhy' || p.d === 'entity') dlouhe.push(obal); else mriz.append(obal);
      }
      form.append(mriz, ...dlouhe);
      const chyby = el('div', { class: 'sk-chyby', role: 'alert' });
      form.append(chyby, el('button', { type: 'submit', hidden: true }));
      telo.append(form);

      async function ulozit(ev) {
        if (ev) ev.preventDefault();
        chyby.textContent = '';
        const d = Object.assign({}, data);   // pole jiných nástrojů zůstanou
        try {
          let novySoubor = null;
          for (const p of typ.pole) {
            const f = vstupy[p.k];
            if (p.d === 'entity') d[p.k] = [...f.querySelectorAll('input:checked')].map(i => i.value);
            else if (p.d === 'soubor') {
              if (f.files && f.files[0]) { novySoubor = await S.ulozSoubor(f.files[0], { nazev: f.files[0].name, pripad: puvodni && puvodni.pripad }); d[p.k] = novySoubor.id; }
            } else {
              const t = f.value.trim();
              d[p.k] = p.d === 'cislo' ? (t === '' ? undefined : Number(t.replace(',', '.'))) : t;
            }
          }
          // otisk nově vloženého souboru má přednost před ručně opsaným
          if (novySoubor && vstupy.sha256) d.sha256 = novySoubor.sha256;
          vysledek = await S.uloz({ id: puvodni && puvodni.id, pripad: puvodni && puvodni.pripad, typ: vstup.typ, nazev: vstupy.nazev.value, data: d }, { nastroj: volby.nastroj });
          dlg.close();
        } catch (x) {
          chyby.textContent = x.chyby && x.chyby.length ? x.chyby.join(' ') : x.message;
        }
      }
      form.addEventListener('submit', ulozit);
      pata.append(el('div', { class: 'sk-vpravo' },
        el('button', { type: 'button', class: 'sk-tl', onclick: () => dlg.close() }, 'Zrušit'),
        el('button', { type: 'button', class: 'sk-tl hlavni', id: 'skUlozit', onclick: () => ulozit() }, '💾 Uložit')));
      vstupy.nazev.focus();
    });
  }

  window.SpisKarta = { otevri, uprav, zavri: () => dlg && dlg.close() };
})();
