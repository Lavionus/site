/* ============================================================
   pisemne.js – mřížka pro počítání pod sebe, do které si žák
   může sám psát (přenosy, mezivýpočty, výsledek).

   Zápis se nijak neopravuje ani nehodnotí: je to papír, na kterém
   se počítá. Správnost se pak ověří výběrem odpovědi jako jinde.

   Použití:
     plocha.appendChild(Pisemne.podSebou(1234, 567, '+'));
     plocha.appendChild(Pisemne.deleni(1234, 4));
   ============================================================ */
const Pisemne = (function () {

  function mrizka(sloupcu) {
    const g = document.createElement('div');
    g.className = 'pisemne-mrizka';
    g.style.gridTemplateColumns = `repeat(${sloupcu}, 1.15em)`;
    return g;
  }

  function bunka(text, trida) {
    const d = document.createElement('div');
    d.className = 'pb ' + (trida || '');
    d.textContent = text === undefined || text === ' ' ? '' : String(text);
    return d;
  }

  function vstup(trida) {
    const i = document.createElement('input');
    i.type = 'text';
    i.inputMode = 'numeric';
    i.maxLength = 1;
    i.autocomplete = 'off';
    i.className = 'pb pb-vstup ' + (trida || '');
    return i;
  }

  /* Číslo zarovnané doprava do dané šířky; volitelně znak úplně vlevo. */
  function radekCisla(g, cislo, sirka, znak) {
    const s = String(cislo).padStart(sirka, ' ');
    for (let i = 0; i < sirka; i++) {
      if (znak && i === 0) { g.appendChild(bunka(znak, 'pb-znak')); continue; }
      g.appendChild(bunka(s[i]));
    }
  }

  function radekVstupu(g, sirka, trida, znak) {
    const pole = [];
    for (let i = 0; i < sirka; i++) {
      if (znak && i === 0) { g.appendChild(bunka(znak, 'pb-znak ' + (trida || ''))); continue; }
      const v = vstup(trida);
      pole.push(v);
      g.appendChild(v);
    }
    return pole;
  }

  /* Písemné počítání jde zprava doleva, takže po napsání číslice
     skáče kurzor o políčko doleva. Šipky fungují oběma směry. */
  function ovladaniKurzoru(korenovy) {
    korenovy.addEventListener('input', e => {
      const el = e.target;
      if (!el.classList || !el.classList.contains('pb-vstup')) return;
      el.value = el.value.replace(/[^0-9]/g, '').slice(-1);
      if (el.value) posun(korenovy, el, -1);
    });
    korenovy.addEventListener('keydown', e => {
      const el = e.target;
      if (!el.classList || !el.classList.contains('pb-vstup')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); posun(korenovy, el, -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); posun(korenovy, el, 1); }
      else if (e.key === 'Backspace' && !el.value) { e.preventDefault(); posun(korenovy, el, 1); }
    });
  }
  function posun(koren, el, smer) {
    const vsechny = [...koren.querySelectorAll('.pb-vstup')];
    const i = vsechny.indexOf(el) + smer;
    if (i >= 0 && i < vsechny.length) vsechny[i].focus();
  }

  function lista(koren, popis) {
    const box = document.createElement('div');
    box.className = 'pisemne-lista';
    const smaz = document.createElement('button');
    smaz.type = 'button';
    smaz.textContent = '🧽 Vymazat zápis';
    smaz.onclick = () => {
      koren.querySelectorAll('.pb-vstup').forEach(v => { v.value = ''; });
      const prvni = koren.querySelector('.pb-vstup:not(.pb-prenos)');
      if (prvni) prvni.focus();
    };
    box.appendChild(smaz);
    koren.appendChild(box);
    if (popis) {
      const p = document.createElement('div');
      p.className = 'pisemne-popis';
      p.textContent = popis;
      koren.appendChild(p);
    }
  }

  /* Sčítání, odčítání, násobení pod sebou.
     Řádek nahoře je na přenosy, řádek pod čarou na výsledek. */
  function podSebou(a, b, znak) {
    const vysledek = znak === '+' ? a + b : znak === '−' ? a - b : a * b;
    const sirka = Math.max(String(a).length, String(b).length, String(vysledek).length) + 1;
    const koren = document.createElement('div');
    koren.className = 'pisemne';
    const g = mrizka(sirka);

    radekVstupu(g, sirka, 'pb-prenos');          // přenosy
    radekCisla(g, a, sirka);
    radekCisla(g, b, sirka, znak);
    const vysl = radekVstupu(g, sirka, 'pb-cara');

    koren.appendChild(g);
    ovladaniKurzoru(koren);
    lista(koren, 'Můžeš si tu počítat: nahoře přenosy, pod čarou výsledek.');
    if (vysl[vysl.length - 1]) setTimeout(() => vysl[vysl.length - 1].focus(), 0);
    return koren;
  }

  /* Písemné dělení: zadání s políčky pro podíl a volná mřížka
     na odčítání mezivýsledků. */
  function deleni(delenec, delitel) {
    const cislic = String(delenec).length;
    const koren = document.createElement('div');
    koren.className = 'pisemne';

    const hlava = document.createElement('div');
    hlava.className = 'pisemne-mrizka';
    hlava.style.gridTemplateColumns = `repeat(${2 * cislic + 4}, 1.15em)`;
    radekCisla(hlava, delenec, cislic);
    hlava.appendChild(bunka(':', 'pb-znak'));
    radekCisla(hlava, delitel, 2);               // dělitel má vždy dvě políčka
    hlava.appendChild(bunka('=', 'pb-znak'));
    for (let i = 0; i < cislic; i++) hlava.appendChild(vstup());
    koren.appendChild(hlava);

    const g = mrizka(cislic + 1);
    for (let r = 0; r < Math.min(6, cislic * 2); r++) {
      radekVstupu(g, cislic + 1, '', r % 2 === 0 ? '−' : '');
    }
    koren.appendChild(g);
    ovladaniKurzoru(koren);
    lista(koren, 'Vpravo za „=" piš podíl, dole si odčítej mezivýsledky.');
    return koren;
  }

  return { podSebou, deleni };
})();
