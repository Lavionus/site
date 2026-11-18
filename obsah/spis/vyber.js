/* Sdílený prvek horní lišty „📁 Spis: [případ ▾]“ – výběr aktivního případu jednotného spisu.
   Použití v nástroji (potřebuje ../dialog.js a spis/jadro.js):
     SpisVyber.vloz(document.querySelector('.lista'), { nastroj: 'evidence_log' });
   Volby: novy(): Promise<případ|null> – vlastní formulář nového případu (jinak Dialog.zeptej),
          bezOdkazu: true – bez položky „Otevřít spis případu“ (na stránce spisu).
   Přepnutí případu platí pro všechny nástroje (localStorage + BroadcastChannel). */
(function () {
  'use strict';
  const S = window.SPIS, el = S.el;

  function styl() {
    if (document.getElementById('spis-vyber-styl')) return;
    const st = el('style', { id: 'spis-vyber-styl' });
    st.textContent = `
.sv-tl{display:inline-flex;align-items:center;gap:4px;max-width:min(46vw,280px);background:var(--bg-control);color:var(--text);border:1px solid var(--border);padding:5px 9px;border-radius:6px;cursor:pointer;font:inherit;font-size:.84rem;line-height:1.3;white-space:nowrap}
.sv-tl:hover{background:var(--bg-hover);border-color:var(--border-strong)}
.sv-tl:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.sv-tl .sv-nazev{overflow:hidden;text-overflow:ellipsis;font-weight:600}
.sv-tl.bez .sv-nazev{font-weight:400;color:var(--text-muted)}
.sv-nab{position:fixed;z-index:70;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);padding:6px;display:flex;flex-direction:column;gap:2px;min-width:240px;max-width:min(92vw,380px);max-height:calc(100vh - 70px);overflow-y:auto}
.sv-nab button{display:flex;align-items:center;gap:6px;text-align:left;background:none;border:1px solid transparent;color:var(--text);padding:7px 10px;border-radius:6px;cursor:pointer;font:inherit;font-size:.86rem}
.sv-nab button:hover{background:var(--bg-hover)}
.sv-nab button[aria-checked="true"]{color:var(--accent);font-weight:600}
.sv-nab button .sv-znak{width:1em;flex:0 0 1em}
.sv-nab button .sv-cislo{margin-left:auto;font-size:.74rem;color:var(--text-faint);padding-left:8px}
.sv-nab hr{border:0;border-top:1px solid var(--border);margin:4px 0}
.sv-nab .sv-pozn{font-size:.74rem;color:var(--text-faint);padding:4px 10px;line-height:1.4}
@media (max-width:520px){.sv-tl .sv-popisek{display:none}}`;
    document.head.appendChild(st);
  }

  function vloz(rodic, volby = {}) {
    styl();
    const nazev = el('span', { class: 'sv-nazev', 'data-i18n': 'ne' }), bez = el('span', { class: 'sv-nazev', text: 'bez spisu' });
    const tl = el('button', { type: 'button', class: 'sv-tl', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Aktivní případ jednotného spisu – platí pro všechny nástroje' },
      '📁', el('span', { class: 'sv-popisek', text: ' Spis:' }), ' ', nazev, bez, ' ▾');
    let nab = null;
    const zavri = () => { if (nab) { nab.remove(); nab = null; tl.setAttribute('aria-expanded', 'false'); } };

    async function obnov() {
      let p = null;
      try { p = S.aktivni() ? await S.pripad(S.aktivni()) : null; } catch (e) { /* bez úložiště */ }
      nazev.textContent = p ? (p.cislo ? p.cislo + ' · ' : '') + p.nazev : '';
      nazev.hidden = !p; bez.hidden = !!p;
      tl.classList.toggle('bez', !p);
    }

    async function otevriNabidku() {
      zavri();
      let seznam = [], chyba = null;
      try { seznam = await S.pripady(); } catch (e) { chyba = e.message; }
      const akt = S.aktivni();
      nab = el('div', { class: 'sv-nab', role: 'menu' });
      if (chyba) nab.append(el('div', { class: 'sv-pozn', text: chyba }));
      for (const p of seznam) {
        nab.append(el('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(p.id === akt), onclick: () => vyber(p.id) },
          el('span', { class: 'sv-znak', text: p.id === akt ? '✓' : '' }), el('span', { 'data-i18n': 'ne', text: p.nazev }), p.cislo ? el('span', { class: 'sv-cislo', 'data-i18n': 'ne', text: p.cislo }) : null));
      }
      if (!seznam.length && !chyba) nab.append(el('div', { class: 'sv-pozn', text: 'Zatím žádný případ.' }));
      nab.append(...[el('hr'),
        el('button', { type: 'button', role: 'menuitem', onclick: novy, disabled: !!chyba }, '➕ Nový případ…'),
        akt ? el('button', { type: 'button', role: 'menuitem', onclick: () => vyber(null) }, '✕ Pracovat bez spisu') : null,
        volby.bezOdkazu ? null : el('button', { type: 'button', role: 'menuitem', onclick: () => { zavri(); S.otevriStranku('spis.html'); } }, '📂 Otevřít spis případu'),
        el('div', { class: 'sv-pozn', text: 'Spis je uložený jen v tomto prohlížeči. Na jiné zařízení se přenáší souborem (balíček spisu).' })].filter(Boolean));
      document.body.append(nab);
      tl.setAttribute('aria-expanded', 'true');
      const r = tl.getBoundingClientRect();
      nab.style.top = (r.bottom + 4) + 'px';
      nab.style.left = Math.max(6, Math.min(r.left, innerWidth - nab.offsetWidth - 6)) + 'px';
      const prvni = nab.querySelector('button'); if (prvni) prvni.focus();
    }

    async function vyber(id) {
      zavri();
      try { await S.otevri(id); } catch (e) { if (window.Dialog) Dialog.chyba(e.message); }
    }
    async function novy() {
      zavri();
      try {
        let p;
        if (volby.novy) p = await volby.novy();
        else {
          const n = await Dialog.zeptej('Název nového případu', '');
          if (n === null || !n.trim()) return;
          p = await S.zalozPripad({ nazev: n }, { nastroj: volby.nastroj });
        }
        if (p) await S.otevri(p.id);
      } catch (e) { Dialog.chyba(e.message); }
    }

    tl.addEventListener('click', e => { e.stopPropagation(); if (nab) zavri(); else otevriNabidku(); });
    document.addEventListener('click', e => { if (nab && !nab.contains(e.target)) zavri(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nab) { zavri(); tl.focus(); } });
    addEventListener('resize', zavri);
    S.odebirej(u => { if (u.druh === 'aktivni' || u.druh === 'pripad' || u.druh === 'import') obnov(); });
    // aktivní případ změněný v jiné záložce bez kanálu (starší prohlížeč)
    addEventListener('storage', e => { if (e.key === S.KLIC_AKTIVNI) obnov(); });
    rodic.append(tl);
    obnov();
    return { prvek: tl, obnov, zavri };
  }

  window.SpisVyber = { vloz };
})();
