/* ============================================================
   podpis.js – autorský podpis ve vlastním pruhu u spodní hrany.
   Vkládá se do <head> každé stránky webu (rozcestník i všechny
   podstránky), aby i samostatně otevřená stránka nesla údaj
   o autorovi.

   Podpis nepřekrývá obsah: tělu stránky se přidá spodní odsazení
   o výšku pruhu a prvky ukotvené napevno u spodní hrany okna se
   o tutéž výšku posunou (nebo zkrátí). Po úpravě se vyvolá událost
   resize, aby si plátna a knihovny (globe.gl, mapy) přepočítaly
   rozměry.

   V rámu (iframe) se nekreslí vůbec — podpis tam patří nadřazené
   stránce, jinak by byl dvakrát pod sebou. Rozlišovat podle originu
   rodiče se neosvědčilo: přes file:// a v některých prohlížečích
   přístup k rodiči selže a stránka se pak považuje za samostatnou.
   Nadřazená stránka navíc pro jistotu uklidí podpis, který si rám
   nakreslil ze starší verze v cache prohlížeče.
   ============================================================ */
(function () {
  const AUTOR = 'Radovan Valenta';
  const MAIL = 'hdm@seznam.cz';
  const DILO = 'Nodus';   // název díla – každý web má v kopii ten svůj
  const ID = 'autor-podpis';
  const VYSKA = 22;            // px – výška pruhu

  if (window.self !== window.top) return;   // v rámu podpis patří nadřazené stránce

  const CSS = `
:root { --podpis-vyska: ${VYSKA}px; }
#${ID} {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: var(--podpis-vyska);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
  font-family: var(--font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 11px;
  line-height: 1;
  letter-spacing: .01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-faint, #9a9a9a);
  background: var(--bg, #1a1a1a);
  border-top: 1px solid var(--border, #333);
  z-index: 2147483000;
  pointer-events: none;   /* nikdy nepohltí kliknutí */
  user-select: none;
}
@media print {
  #${ID} { position: static; border: 0; background: none; color: #444; }
}`;

  // Rozměry počítané z celé výšky okna (height: 100vh) o pruhu nevědí —
  // tělo pod nimi jen naroste a obsah zmizí pod pruhem. Proto se v CSS
  // stránky 100vh zmenší o výšku pruhu. Pravidla z cizího originu
  // (CDN) přístup k cssRules zakážou, ty se přeskočí.
  const VH = /\b100(vh|dvh|svh|lvh)\b/;
  const ROZMERY = ['height', 'min-height', 'max-height', 'top', 'bottom', 'inset'];

  function zmensVCssPravidle(pravidlo) {
    const deklarace = pravidlo.style;
    if (deklarace) {
      for (const vlastnost of ROZMERY) {
        const hodnota = deklarace.getPropertyValue(vlastnost);
        if (hodnota && VH.test(hodnota)) {
          deklarace.setProperty(vlastnost,
            hodnota.replace(/\b100(vh|dvh|svh|lvh)\b/g, 'calc(100$1 - var(--podpis-vyska))'),
            deklarace.getPropertyPriority(vlastnost));
        }
      }
    }
    // @media, @supports i vnořená pravidla; pozor: v dnešním Chrome má
    // `cssRules` (prázdné) i obyčejné pravidlo, proto se deklarace řeší vždy
    const vnorena = pravidlo.cssRules;
    if (vnorena) for (const vnorene of vnorena) zmensVCssPravidle(vnorene);
  }

  function zmensCeloobrazovkove() {
    for (const sesit of document.styleSheets) {
      let pravidla;
      try { pravidla = sesit.cssRules; } catch { continue; }   // sešit z cizího originu
      if (!pravidla) continue;
      for (const pravidlo of pravidla) zmensVCssPravidle(pravidlo);
    }
    for (const el of document.querySelectorAll('[style*="vh"]')) {
      if (el.id !== ID) zmensVCssPravidle(el);
    }
  }

  // Prvky ukotvené napevno u spodní hrany okna: pruh by je překryl.
  // Celoobrazovkové (fixed inset:0) se zkrátí, malé ovládání se posune nad pruh.
  function uhniPruhu() {
    for (const el of document.querySelectorAll('body *')) {
      if (el.id === ID) continue;
      let s;
      try { s = getComputedStyle(el); } catch { continue; }
      if (s.position !== 'fixed') continue;

      const r = el.getBoundingClientRect();
      const hornihranaPruhu = window.innerHeight - VYSKA;
      if (r.height < 1 || r.bottom <= hornihranaPruhu + 1) continue;     // do pruhu nezasahuje
      if (el.dataset.podpisUhnul) continue;

      if (s.bottom !== 'auto') {
        el.dataset.podpisUhnul = '1';
        el.style.bottom = `calc(${s.bottom} + var(--podpis-vyska))`;
      } else if (r.top <= 1) {                 // drží ho horní hrana, zkrátíme výšku
        el.dataset.podpisUhnul = '1';
        el.style.maxHeight = 'calc(100vh - var(--podpis-vyska))';
      }
    }
  }

  // Pojistka pro přechodné období: stránka v rámu může běžet ze starší verze
  // uložené v cache prohlížeče a podpis si nakreslit. Nadřazená stránka ho
  // odklidí, aby nebyl dvakrát pod sebou.
  function uklidVRamech() {
    for (const ram of document.querySelectorAll('iframe')) {
      let dokument;
      try { dokument = ram.contentDocument; } catch { continue; }   // cizí origin
      if (!dokument) continue;
      for (const cizi of dokument.querySelectorAll('#' + ID)) cizi.remove();
    }
  }

  function vloz() {
    if (document.getElementById(ID)) return;

    const styl = document.createElement('style');
    styl.textContent = CSS;
    document.head.appendChild(styl);

    // vlastní řádek: obsah stránky končí nad pruhem, ne pod ním
    const telo = document.body;
    const puvodni = getComputedStyle(telo).paddingBottom;
    if (getComputedStyle(telo).boxSizing !== 'border-box') telo.style.boxSizing = 'border-box';
    telo.style.paddingBottom = `calc(${puvodni} + var(--podpis-vyska))`;

    const podpis = document.createElement('div');
    podpis.id = ID;
    podpis.textContent = DILO + ' © ' + AUTOR + ' · ' + MAIL;
    telo.appendChild(podpis);

    zmensCeloobrazovkove();
    uhniPruhu();

    // Plátna a knihovny si po zmenšení plochy přepočítají rozměry. Až po
    // `load` — stránky, které se inicializují tam (Heritage), mají v tu chvíli
    // obsluhu resize už zaregistrovanou, ale plátno ještě nevytvořené.
    const prepocitej = () => { uhniPruhu(); uklidVRamech(); window.dispatchEvent(new Event('resize')); };
    if (document.readyState === 'complete') prepocitej();
    else window.addEventListener('load', prepocitej, { once: true });

    // rozcestník mění src rámu za běhu – uklidit po každém načtení stránky v rámu
    document.addEventListener('load', e => {
      if (e.target && e.target.tagName === 'IFRAME') uklidVRamech();
    }, true);

    let cas;
    window.addEventListener('resize', () => { clearTimeout(cas); cas = setTimeout(uhniPruhu, 200); });

    // ve fullscreenu se kreslí jen podstrom zvoleného prvku
    document.addEventListener('fullscreenchange', () => {
      const fs = document.fullscreenElement;
      const cil = (fs && fs.tagName !== 'CANVAS') ? fs : document.body;
      if (podpis.parentNode !== cil) cil.appendChild(podpis);
    });
  }

  // soubor se linkuje s defer, tělo tedy už existuje
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vloz);
  else vloz();
})();
