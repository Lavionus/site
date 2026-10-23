/* ============================================================
   Písmolijna – ui/kontrola.js
   Kontrola chyb fontu (obdoba Find Problems / Validate ve
   FontForge): tabulka nálezů, filtr, skok do glyfu, oprava.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP;
  const el = A.el;
  const koren = document.getElementById('kontrola');
  let nalezy = [], filtr = A.nastaveni.kontrolaFiltr || 'vse', platne = false;
  const ZAV = { chyba: 'Chyba', varovani: 'Varování', info: 'Info' };
  const DRUHY = {
    blizkeBody: 'body skoro totožné', cyklus: 'cyklus komponent', duplicitniUnicode: 'duplicitní Unicode', extremy: 'chybí extrémy',
    chybiCeske: 'chybí česká písmena', chybiGlyf: 'chybí glyf', info: 'informace o fontu', kerning: 'kerning', komponenta: 'komponenta',
    ligatura: 'ligatura', malyObrys: 'malý obrys', mezery: 'mezery', mimoMeze: 'mimo svislé meze', mnohoBodu: 'příliš mnoho bodů',
    nazev: 'název glyfu', necelociselne: 'neceločíselné souřadnice', nulovaSirka: 'nulová šířka', otevreny: 'otevřený obrys',
    prazdny: 'prázdný glyf', prekryv: 'překryv obrysů', samopruniky: 'samoprůnik', smer: 'směr obrysu', zapornaSirka: 'záporná šířka',
    zbytecnyBod: 'zbytečný bod'
  };

  function spust() {
    if (typeof P.zkontroluj !== 'function') { koren.innerHTML = ''; koren.append(el('p', { class: 'poznamka', text: 'Modul kontroly není načtený.' })); return; }
    const t0 = performance.now();
    try { nalezy = P.zkontroluj(A.font, {}) || []; }
    catch (e) { nalezy = []; A.zprava('Kontrola selhala: ' + e.message, true); }
    platne = true;
    vykresli(Math.round(performance.now() - t0));
  }

  function vykresli(ms) {
    koren.innerHTML = '';
    const pocty = { chyba: 0, varovani: 0, info: 0 };
    for (const n of nalezy) pocty[n.zavaznost] = (pocty[n.zavaznost] || 0) + 1;
    const vyber = el('select', { 'aria-label': 'Filtr závažnosti' }, [['vse', 'Vše (' + nalezy.length + ')'], ['chyba', 'Chyby (' + pocty.chyba + ')'], ['varovani', 'Varování (' + pocty.varovani + ')'], ['info', 'Info (' + pocty.info + ')']]
      .map(([v, t]) => { const o = el('option', { value: v, text: t }); if (v === filtr) o.selected = true; return o; }));
    vyber.addEventListener('change', () => { filtr = vyber.value; A.nastaveni.kontrolaFiltr = filtr; A.ulozNastaveni(); vykresli(); });
    const opravitelne = nalezy.filter(n => n.oprava);
    koren.append(el('div', { class: 'ovl' }, [
      el('button', { type: 'button', class: 'tl hlavni', text: '🩺 Zkontrolovat znovu', onclick: spust }),
      vyber,
      el('button', { type: 'button', class: 'tl', text: '🔧 Opravit vše opravitelné (' + opravitelne.length + ')', disabled: !opravitelne.length, onclick: opravVse }),
      el('span', { class: 'poznamka', text: ms != null ? 'Kontrola trvala ' + ms + ' ms.' : '' })
    ]));
    const zobraz = nalezy.filter(n => filtr === 'vse' || n.zavaznost === filtr);
    if (!zobraz.length) {
      koren.append(el('p', { style: 'margin:16px 0', text: nalezy.length ? 'V tomto filtru nic není.' : '✓ Žádné problémy nenalezeny.' }));
      return;
    }
    // souhrn podle druhu
    const druhy = new Map();
    for (const n of zobraz) druhy.set(n.druh, (druhy.get(n.druh) || 0) + 1);
    koren.append(el('p', { class: 'poznamka', text: Array.from(druhy).map(([d, c]) => (DRUHY[d] || d) + ': ' + c).join(' · ') }));
    const tbody = el('tbody');
    const LIMIT = 1000;
    for (const n of zobraz.slice(0, LIMIT)) {
      tbody.append(el('tr', {}, [
        el('td', { class: 'z-' + n.zavaznost, text: ZAV[n.zavaznost] || n.zavaznost }),
        el('td', {}, n.glyf ? el('a', { text: n.glyf, title: 'Otevřít v editoru', onclick: () => ukaz(n) }) : '—'),
        el('td', { text: n.zprava }),
        el('td', {}, n.oprava ? el('button', { type: 'button', class: 'tl', text: 'Opravit', onclick: () => oprav(n) }) : '')
      ]));
    }
    koren.append(el('table', {}, [el('thead', {}, el('tr', {}, ['Závažnost', 'Glyf', 'Problém', ''].map(t => el('th', { text: t })))), tbody]));
    if (zobraz.length > LIMIT) koren.append(el('p', { class: 'poznamka', text: '… a dalších ' + (zobraz.length - LIMIT) + '.' }));
  }

  function ukaz(n) {
    if (!A.font.glyfy[n.glyf]) return;
    A.otevriGlyf(n.glyf);
    const E = A.editor;
    E.vyber.clear();
    if (n.obrys != null) {
      const o = A.font.glyfy[n.glyf].obrysy[n.obrys];
      if (o) {
        if (n.bod != null && o.body[n.bod]) E.vyber.add(n.obrys + ',' + n.bod);
        else o.body.forEach((p, i) => E.vyber.add(n.obrys + ',' + i));
      }
    }
    E.oznamVyber();
  }
  function rozsah(n) { return n.glyf ? { glyfy: [n.glyf] } : { cely: true }; }
  function oprav(n) {
    let ok = false;
    A.zmen('Oprava: ' + n.druh, rozsah(n), () => { ok = P.opravNalez(A.font, n); });
    if (!ok) A.zprava('Tohle se automaticky opravit nedá – otevřete glyf a upravte ho ručně.', true);
    spust();
  }
  function opravVse() {
    const opr = nalezy.filter(n => n.oprava);
    const glyfy = Array.from(new Set(opr.map(n => n.glyf).filter(Boolean)));
    let pocet = 0;
    A.zmen('Opravit vše', opr.some(n => !n.glyf) ? { cely: true } : { glyfy }, () => {
      // nálezy s indexy obrysů/bodů se opravují od konce, ať indexy platí
      const serazene = opr.slice().sort((a, b) => (b.obrys || 0) - (a.obrys || 0) || (b.bod || 0) - (a.bod || 0));
      for (const n of serazene) { try { if (P.opravNalez(A.font, n)) pocet++; } catch (e) { console.warn(e); } }
    });
    A.zprava('Opraveno: ' + pocet + ' z ' + opr.length + '.');
    spust();
  }

  A.na('zmena', () => { platne = false; });
  A.na('font', () => { platne = false; nalezy = []; });
  A.na('pohled', p => { if (p === 'kontrola' && !platne) spust(); });
  A.kontrola = { spust };
})();
