/* ============================================================
   trubky_gui.js – ovládání společného rozvržení generátorů trubek
   (tubeRed.html, tubeRedFlat.html, tubeSplit.html), viz trubky_gui.css.

   Stránka zavolá po vytvoření scény:
     TrubkyGui.pripoj({
       klic,            // localStorage pro rozbalené oddíly, záložku a box
       pohled(jmeno),   // tlačítka [data-pohled] v nabídce Pohled
       zmenaVelikosti() // náhled změnil velikost (ResizeObserver)
     })
   Značky v HTML:
     [data-nabidka="id"]  tlačítko lišty → .nabidka#id (položky .pol nabídku zavřou)
     .zalozky [data-zalozka="x"] + .zalozka-telo[data-telo="x"]
     details.oddil[data-oddil="…"]   stav rozbalení se pamatuje
     .prepinac-boxu [data-ukaz="in|obecne|out"] + .plocha[data-zobrazeno]
     #btnNapoveda → dialog#napoveda
   Stav rozvržení je jen pohodlí jednoho prohlížeče — bez úložiště
   (soukromé okno) stránka funguje, jen si nic nepamatuje.
   ============================================================ */
window.TrubkyGui = (function () {
  let klic = null;

  function cti() {
    try { return JSON.parse(localStorage.getItem(klic)) || {}; } catch (e) { return {}; }
  }
  function uloz(zmena) {
    if (!klic) return;
    try { localStorage.setItem(klic, JSON.stringify({ ...cti(), ...zmena })); } catch (e) { /* bez úložiště */ }
  }

  function zavriNabidky(krome) {
    document.querySelectorAll('.nabidka').forEach(n => { if (n !== krome) n.hidden = true; });
    document.querySelectorAll('[data-nabidka]').forEach(b => {
      if (!krome || b.dataset.nabidka !== krome.id) b.setAttribute('aria-expanded', 'false');
    });
  }

  // úzký displej: který box je vidět (vstup / obecné / výstup)
  function ukazBox(kdo) {
    const plocha = document.querySelector('.plocha');
    if (plocha) plocha.dataset.zobrazeno = kdo;
    document.querySelectorAll('.prepinac-boxu button').forEach(b => b.classList.toggle('aktivni', b.dataset.ukaz === kdo));
  }

  function otevriZalozku(jm) {
    document.querySelectorAll('.zalozky [data-zalozka]').forEach(b => {
      b.setAttribute('aria-selected', String(b.dataset.zalozka === jm));
      b.tabIndex = b.dataset.zalozka === jm ? 0 : -1;
    });
    document.querySelectorAll('.zalozka-telo').forEach(t => { t.hidden = t.dataset.telo !== jm; });
    ukazBox('obecne');
    uloz({ zalozka: jm });
  }

  // souhrn v záhlaví oddílu; `zapnuto` = něco je nastavené (zvýrazní se)
  function souhrn(id, text, zapnuto) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('zapnuto', !!zapnuto);
  }

  // chyba zadání: box, kterého se týká, dostane v záhlaví vykřičník
  function oznacChybu(idBoxu, ano) {
    const el = document.getElementById(idBoxu);
    if (el) el.classList.toggle('ma-chybu', !!ano);
  }

  function pripoj(cfg) {
    klic = cfg.klic || null;
    const tlacitka = [...document.querySelectorAll('[data-nabidka]')];
    tlacitka.forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const n = document.getElementById(b.dataset.nabidka), otevrit = n.hidden;
        zavriNabidky(otevrit ? n : null);
        n.hidden = !otevrit;
        b.setAttribute('aria-expanded', String(otevrit));
      });
      // s otevřenou nabídkou stačí přejet myší na vedlejší (jako v menu aplikací)
      b.addEventListener('mouseenter', () => {
        const otevrena = [...document.querySelectorAll('.nabidka')].find(n => !n.hidden);
        if (otevrena && otevrena.id !== b.dataset.nabidka) b.click();
      });
      // šipka dolů otevře nabídku a skočí na první položku
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        const n = document.getElementById(b.dataset.nabidka);
        if (n.hidden) b.click();
        const prvni = n.querySelector('.pol, input, select');
        if (prvni) prvni.focus();
      });
    });
    // položka nabídku zavře, klik do políček (výběr, barva, posuvník) ne
    document.querySelectorAll('.nabidka').forEach(n => {
      n.addEventListener('click', e => { if (e.target.closest('.pol')) zavriNabidky(null); else e.stopPropagation(); });
      n.addEventListener('keydown', e => {
        const pol = [...n.querySelectorAll('.pol')], i = pol.indexOf(document.activeElement);
        if (i < 0 || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
        e.preventDefault();
        pol[(i + (e.key === 'ArrowDown' ? 1 : pol.length - 1)) % pol.length].focus();
      });
    });
    document.addEventListener('click', () => zavriNabidky(null));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const otevrena = [...document.querySelectorAll('.nabidka')].find(n => !n.hidden);
      zavriNabidky(null);
      if (otevrena) document.querySelector(`[data-nabidka="${otevrena.id}"]`).focus();
    });

    if (cfg.pohled) document.querySelectorAll('[data-pohled]').forEach(b => b.addEventListener('click', () => cfg.pohled(b.dataset.pohled)));
    const nap = document.getElementById('btnNapoveda'), okno = document.getElementById('napoveda');
    if (nap && okno) nap.addEventListener('click', () => okno.showModal());

    const zal = [...document.querySelectorAll('.zalozky [data-zalozka]')];
    zal.forEach(b => b.addEventListener('click', () => otevriZalozku(b.dataset.zalozka)));
    const pas = document.querySelector('.zalozky');
    if (pas) pas.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!k) return;
      const i = zal.findIndex(b => b.getAttribute('aria-selected') === 'true');
      const dalsi = zal[(i + k + zal.length) % zal.length];
      otevriZalozku(dalsi.dataset.zalozka);
      dalsi.focus();
    });
    document.querySelectorAll('.prepinac-boxu button').forEach(b => b.addEventListener('click', () => {
      ukazBox(b.dataset.ukaz);
      uloz({ box: b.dataset.ukaz });
    }));

    const r = cti();
    document.querySelectorAll('.oddil').forEach(d => {
      if (r.oddily && d.dataset.oddil in r.oddily) d.open = !!r.oddily[d.dataset.oddil];
      d.addEventListener('toggle', () => uloz({ oddily: { ...(cti().oddily || {}), [d.dataset.oddil]: d.open } }));
    });
    if (zal.length) otevriZalozku(r.zalozka && document.querySelector(`[data-zalozka="${r.zalozka}"]`) ? r.zalozka : zal[0].dataset.zalozka);
    ukazBox(r.box || 'obecne');

    // náhled mění velikost i bez změny okna (přepnutí boxu, výška záložek)
    const nahled = document.getElementById('canvas-container');
    if (cfg.zmenaVelikosti && nahled && window.ResizeObserver) new ResizeObserver(() => cfg.zmenaVelikosti()).observe(nahled);
  }

  return { pripoj, otevriZalozku, ukazBox, souhrn, oznacChybu, zavriNabidky };
})();
