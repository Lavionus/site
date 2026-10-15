/* Modelář 3D – seznam objektů v panelu.
   Řádek: barva (nebo šrafa díry), název, oko (skrýt/ukázat), zámek.
   Klik vybere, Shift/Ctrl+klik přidá k výběru. Skrytá tělesa jdou
   odkrýt jen odsud (ve scéně nejsou vidět ani vybrat). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  M.vytvorSeznam = function (ul, pocitadlo) {
    let podpis = '';
    function vykresli() {
      const dok = M.app.dok, vyber = new Set(M.app.vyber);
      // při tažení se mění jen polohy – seznam (500 řádků) se přestaví, jen když se změní, co ukazuje
      const novy = M.app.vyber.join(',') + '|' + dok.uzly.map(u => [u.id, u.nazev, u.barva, u.role, u.skryto, u.zamceno, u.barevne, u.deti ? u.deti.length : ''].join('\u0001')).join('\u0002');
      if (novy === podpis) return;
      podpis = novy;
      // fokus na tlačítku (oko, zámek) po přestavbě vrátit na stejné místo – klávesnicí jde pokračovat
      const a = document.activeElement, fokus = a && ul.contains(a) && a.closest('li[data-id]') ? { id: a.closest('li[data-id]').dataset.id, trida: a.classList[1] || a.classList[0] } : null;
      pocitadlo.textContent = dok.uzly.length ? `(${dok.uzly.length})` : '';
      if (!dok.uzly.length) {
        ul.innerHTML = '<li class="prazdny">Zatím nic. Tvar vložíš z nabídky ✚ Tvary v liště.</li>';
        return;
      }
      ul.innerHTML = dok.uzly.map(u => `
        <li class="${vyber.has(u.id) ? 'vybrany' : ''}${u.skryto ? ' skryty' : ''}" data-id="${esc(u.id)}">
          <span class="znak${u.role === 'dira' ? ' dira' : ''}${u.druh === 'skupina' && u.barevne ? ' barevny' : ''}" style="${u.role === 'dira' || (u.druh === 'skupina' && u.barevne) ? '' : 'background:' + u.barva}"></span>
          <button type="button" class="jmeno" title="Vybrat">${u.druh === 'skupina' ? '🧩 ' : ''}${esc(u.nazev)}${u.druh === 'skupina' ? ` <span class="pocet">(${u.deti.length})</span>` : ''}</button>
          <button type="button" class="ikona oko" aria-pressed="${u.skryto}" title="${u.skryto ? 'Ukázat' : 'Skrýt'}" aria-label="Skrýt ${esc(u.nazev)}">${u.skryto ? '◌' : '👁'}</button>
          <button type="button" class="ikona zamek" aria-pressed="${u.zamceno}" title="${u.zamceno ? 'Odemknout' : 'Zamknout'}" aria-label="Zamknout ${esc(u.nazev)}">${u.zamceno ? '🔒' : '🔓'}</button>
        </li>`).join('');
      if (fokus) {
        const b = ul.querySelector(`li[data-id="${CSS.escape(fokus.id)}"] .${CSS.escape(fokus.trida)}`);
        if (b) b.focus();
      }
    }
    ul.addEventListener('click', e => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const id = li.dataset.id, u = M.najdiUzel(M.app.dok, id);
      if (!u) return;
      if (e.target.closest('.oko')) M.upravVybrane({ skryto: !u.skryto }, u.skryto ? 'Ukázat' : 'Skrýt', [id]);
      else if (e.target.closest('.zamek')) M.upravVybrane({ zamceno: !u.zamceno }, u.zamceno ? 'Odemknout' : 'Zamknout', [id]);
      else if (e.target.closest('.jmeno')) {
        if (u.skryto) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) M.prepniVyber(id); else M.nastavVyber([id]);
      }
    });
    M.na('dokument', vykresli);
    M.na('vyber', vykresli);
    vykresli();
  };
})(MDL);
