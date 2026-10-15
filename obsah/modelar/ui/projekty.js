/* Modelář 3D – přehled projektů (okno s kartami).
   Karta: náhled, název, kdy upraveno, počet těles; akce Otevřít, Kopie,
   Stáhnout (.modelar) a Smazat (s potvrzením). Nahoře Nový projekt
   a Otevřít soubor. Aktuální projekt je zvýrazněný. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function kdy(t) {
    const d = (Date.now() - t) / 1000;
    if (d < 60) return 'právě teď';
    if (d < 3600) return `před ${Math.floor(d / 60)} min`;
    if (d < 86400) return `před ${Math.floor(d / 3600)} h`;
    return new Date(t).toLocaleDateString('cs', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  M.vytvorProjekty = function (U) {
    const okno = $('oknoProjektu'), mriz = $('projektyMriz');

    async function vykresli() {
      if (!U.dostupne) {
        mriz.innerHTML = '<p class="prazdny">Prohlížeč nedovolil ukládat projekty (soukromé okno nebo zakázané úložiště). Projekt si ulož do souboru přes Soubor → Uložit do souboru.</p>';
        return;
      }
      const seznam = await U.seznam();
      if (!seznam.length) { mriz.innerHTML = '<p class="prazdny">Zatím žádný projekt.</p>'; return; }
      const akt = M.app.projekt && M.app.projekt.id;
      mriz.innerHTML = seznam.map(p => `
        <article class="karta${p.id === akt ? ' aktualni' : ''}" data-id="${esc(p.id)}">
          <button type="button" class="nahled" data-akce="otevrit" title="Otevřít" aria-label="Otevřít projekt ${esc(p.nazev)} (náhled)" tabindex="-1">${p.nahled ? `<img src="${p.nahled}" alt="">` : '<span>🧊</span>'}</button>
          <div class="info"><strong>${esc(p.nazev)}</strong><small>${kdy(p.upraveno)} · ${M.pocet(p.pocet || 0, 'těleso', 'tělesa', 'těles')}${p.id === akt ? ' · otevřený' : ''}</small></div>
          <div class="akce">
            <button type="button" class="tl" data-akce="otevrit" aria-label="Otevřít projekt ${esc(p.nazev)}">Otevřít</button>
            <button type="button" class="tl ik" data-akce="kopie" title="Kopie projektu" aria-label="Kopie projektu ${esc(p.nazev)}">⧉</button>
            <button type="button" class="tl ik" data-akce="stahnout" title="Stáhnout jako soubor .modelar" aria-label="Stáhnout projekt ${esc(p.nazev)} jako soubor">⬇</button>
            <button type="button" class="tl ik nebezpeci" data-akce="smazat" title="Smazat projekt" aria-label="Smazat projekt ${esc(p.nazev)}">🗑</button>
          </div>
        </article>`).join('');
    }

    mriz.addEventListener('click', async e => {
      const b = e.target.closest('[data-akce]');
      const k = e.target.closest('.karta');
      if (!b || !k) return;
      const id = k.dataset.id;
      try {
        if (b.dataset.akce === 'otevrit') { await U.otevri(id); okno.close(); }
        else if (b.dataset.akce === 'kopie') { await U.duplikuj(id); await vykresli(); }
        else if (b.dataset.akce === 'stahnout') { const p = await U.nacti(id); await M.ulozDoSouboru(p); }
        else if (b.dataset.akce === 'smazat') {
          const nazev = k.querySelector('strong').textContent;
          if (await Dialog.potvrd(`Smazat projekt „${nazev}“? Nejde to vrátit.`)) { await U.smaz(id); await vykresli(); }
        }
      } catch (err) { console.error(err); Dialog.chyba(err.message); }
    });
    $('projektyNovy').onclick = async () => { await U.novy(); okno.close(); };
    $('projektyOtevrit').onclick = () => { okno.close(); $('vstupSouboru').click(); };
    $('projektyZavrit').onclick = () => okno.close();

    M.otevriProjekty = async function () {
      await U.ulozTed();
      await vykresli();
      if (!okno.open) okno.showModal();
      // první fokus na první projekt (ne na „Nový projekt“ – omylem stisknutý Enter by založil nový)
      const prvni = okno.querySelector('.karta [data-akce="otevrit"].tl');
      if (prvni) prvni.focus();
    };
    return { vykresli };
  };
})(MDL);
