/* Modelář 3D – panel Proměnné projektu (Dílna → ƒx Proměnné…).
   Tabulka jméno / výraz / hodnota; změna proměnné přepočítá všechna pole se vzorcem
   (inspektor: do pole napiš třeba „D/2 + vule“) a kóty skic s výrazy – jeden krok historie.
   Přejmenování opraví všechny výrazy, smazání použité proměnné dosadí do výrazů její hodnotu. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  M.vytvorPromenne = function () {
    const okno = document.createElement('dialog');
    okno.id = 'oknoPromenne';
    okno.className = 'okno vedle okno-promenne';
    okno.setAttribute('aria-labelledby', 'promNadpis');
    okno.innerHTML = `<h2 id="promNadpis">ƒx Proměnné projektu</h2>
      <p class="poznamka">Do kteréhokoli číselného pole v inspektoru (rozměr, poloha, parametr dílu) nebo do kóty ve skice napiš výraz s proměnnou – třeba <code>D/2 + vule</code>. Po změně proměnné se všechno přepočítá.</p>
      <table class="prom-tabulka"><thead><tr><th>Jméno</th><th>Výraz</th><th>Hodnota</th><th><span class="sr">Akce</span></th></tr></thead><tbody id="promRadky"></tbody></table>
      <div class="radek"><button type="button" class="tl" id="promPridat">✚ Přidat proměnnou</button></div>
      <p class="chyba-text" id="promChyby" aria-live="polite"></p>
      <p class="poznamka">Jméno: písmena, číslice a _ (ne mm, cm, m, in, pi ani funkce). Výraz smí použít jiné proměnné, jednotky (3 cm), pi a funkce sqrt, min, max, round, sin, cos, tan (°); argumenty odděl středníkem.</p>
      <div class="tlacitka"><button type="button" class="tl hlavni-tl" id="promZavrit">Zavřít</button></div>`;
    document.body.appendChild(okno);
    const radky = $('promRadky');

    function chybyText(dok) {
      const r = M.vyhodnotPromenne(dok.promenne || []);
      const out = Object.entries(r.chyby).map(([j, t]) => `${j}: ${t}`);
      const vz = M.aplikujVzorce(dok).chyby;
      if (vz.length) out.push(`Pole, která nejde spočítat: ${vz.slice(0, 4).map(c => `„${c.nazev}“ ${c.klic} = ${c.vyraz}`).join(', ')}${vz.length > 4 ? '…' : ''}`);
      return out.join(' · ');
    }

    // přestavba až po dokončení události (smazání pole s fokusem uprostřed change vyvolá blur → další change);
    // fokus zůstane na stejném poli téhož řádku
    let planStavby = null;
    function postav() {
      if (planStavby) return;
      planStavby = setTimeout(() => {
        planStavby = null;
        const a = document.activeElement, tr = a && radky.contains(a) ? a.closest('tr[data-i]') : null;
        const kde = tr ? [tr.dataset.i, a.className] : null;
        postavHned();
        if (kde) { const el = radky.querySelector(`tr[data-i="${kde[0]}"] .${kde[1].split(' ')[0]}`); if (el) el.focus(); }
      }, 0);
    }
    function postavHned() {
      const dok = M.app.dok, prom = dok.promenne || [];
      const h = M.vyhodnotPromenne(prom);
      radky.innerHTML = prom.map((p, i) => {
        const v = h.hodnoty.get(p.jmeno.toLowerCase()), n = M.pouzitiPromenne(dok, p.jmeno);
        return `<tr data-i="${i}">
          <td><input class="prom-jmeno" value="${esc(p.jmeno)}" aria-label="Jméno proměnné ${i + 1}" spellcheck="false" autocomplete="off"></td>
          <td><input class="prom-vyraz" value="${esc(p.vyraz)}" aria-label="Výraz proměnné ${esc(p.jmeno)}" spellcheck="false" autocomplete="off" inputmode="decimal"></td>
          <td class="prom-hodnota${h.chyby[p.jmeno] ? ' chyba' : ''}" title="${esc(h.chyby[p.jmeno] || '')}">${h.chyby[p.jmeno] ? '⚠' : M.mm(v, 3)}</td>
          <td><button type="button" class="tl ik prom-smaz" title="Smazat proměnnou${n ? ` (použitá ${n}×: do výrazů se dosadí hodnota)` : ''}" aria-label="Smazat proměnnou ${esc(p.jmeno)}">🗑</button></td></tr>`;
      }).join('') || `<tr><td colspan="4" class="poznamka">Zatím žádné proměnné.</td></tr>`;
      $('promChyby').textContent = chybyText(dok);
    }

    /** Zapíše nový seznam proměnných a přepočítá vzorce (jeden krok historie). */
    function zapis(dok, popis) {
      const r = M.aplikujVzorce(dok);
      M.zmenDokument(r.dok, popis);
      postav();
      return r;
    }

    radky.addEventListener('change', e => {
      const tr = e.target.closest('tr[data-i]');
      if (!tr) return;
      const i = +tr.dataset.i, dok = M.app.dok, prom = (dok.promenne || []).slice(), p = prom[i];
      if (!p) return;
      if (e.target.classList.contains('prom-jmeno')) {
        const nove = e.target.value.trim();
        if (nove === p.jmeno) return;
        try { zapis(M.prejmenujPromennou(dok, p.jmeno, nove), 'Přejmenovat proměnnou'); }
        catch (x) { M.oznamPole(e.target, x.message.charAt(0).toUpperCase() + x.message.slice(1) + '.'); e.target.value = p.jmeno; }
        return;
      }
      if (e.target.classList.contains('prom-vyraz')) {
        const vyraz = e.target.value.trim() || '0';
        // výraz musí jít spočítat (s ostatními proměnnými); jinak ho nechat jak byl
        prom[i] = Object.assign({}, p, { vyraz });
        const h = M.vyhodnotPromenne(prom);
        if (h.chyby[p.jmeno]) { M.oznamPole(e.target, `„${vyraz}“: ${h.chyby[p.jmeno]}.`); e.target.value = p.vyraz; return; }
        const r = zapis(Object.assign({}, dok, { promenne: M.normalizujPromenne(prom) }), 'Proměnná ' + p.jmeno);
        if (r.zmenenych) Dialog.info(`Přepočítáno: ${M.pocet(r.zmenenych, 'těleso', 'tělesa', 'těles')}.`);
      }
    });
    radky.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); e.target.select(); }
    });
    radky.addEventListener('click', async e => {
      const b = e.target.closest('.prom-smaz');
      if (!b) return;
      const i = +b.closest('tr').dataset.i, p = (M.app.dok.promenne || [])[i];
      if (!p) return;
      const n = M.pouzitiPromenne(M.app.dok, p.jmeno);
      if (n && !(await Dialog.potvrd(`Proměnná „${p.jmeno}“ je použitá ${n}×. Smazat ji? Do výrazů se dosadí její současná hodnota, tvary se nezmění.`))) return;
      zapis(M.odeberPromennou(M.app.dok, p.jmeno), 'Smazat proměnnou');
    });
    $('promPridat').onclick = () => {
      const prom = (M.app.dok.promenne || []).slice();
      let k = 1;
      const jm = () => 'P' + k;
      while (prom.some(p => p.jmeno.toLowerCase() === jm().toLowerCase())) k++;
      prom.push({ jmeno: jm(), vyraz: '10' });
      zapis(Object.assign({}, M.app.dok, { promenne: M.normalizujPromenne(prom) }), 'Přidat proměnnou');
      clearTimeout(planStavby); planStavby = null; postavHned();
      const posledni = radky.querySelector('tr:last-child .prom-jmeno');
      if (posledni) { posledni.focus(); posledni.select(); }
    };
    const zavri = () => { if (okno.open) okno.close(); };
    $('promZavrit').onclick = zavri;
    okno.addEventListener('cancel', e => { e.preventDefault(); zavri(); });

    M.otevriPromenne = function () {
      postavHned();
      M.otevriPanel(okno);
    };
    // jiná změna dokumentu (Zpět, inspektor): obnovit hodnoty, pokud uživatel zrovna nepíše
    M.na('dokument', () => { if (okno.open && !okno.contains(document.activeElement)) postav(); });
  };
})(MDL);
