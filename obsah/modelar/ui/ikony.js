/* Modelář 3D – ikony rozhraní (sada assets/icons-cad, 64px WebP ve složce ui/).
   Jedno mapování: příkaz (M.PRIKAZY id) → ikona. Používá ho lišta, nabídky, panely
   i paleta příkazů. Tlačítko si ikonu vezme podle data-prikaz, data-soubor, data-pohled,
   data-nabidka nebo id; úvodní znak (emoji nebo symbol) v jeho textu ikona nahradí.
   Původní znaky zůstávají v HTML, takže bez obrázků (nebo bez JS) je rozhraní pořád čitelné. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const CESTA = 'modelar/assets/icons-cad/ui/';

  /** Příkaz → ikona. */
  M.IKONY = {
    zpet: 'undo', znovu: 'redo', seskupit: 'group', rozdelit: 'ungroup', duplikovat: 'duplicate', tvary: 'add-shape',
    zrcadlit: 'mirror', zarovnat: 'align', naDesku: 'place-on-bed', plochou: 'align-z-min', rovina: 'workplane',
    zrcadlitX: 'mirror-x', zrcadlitY: 'mirror-y', zrcadlitZ: 'mirror-z',
    zarovnatX_min: 'align-x-min', zarovnatX_stred: 'align-x-center', zarovnatX_max: 'align-x-max',
    zarovnatY_min: 'align-y-min', zarovnatY_stred: 'align-y-center', zarovnatY_max: 'align-y-max',
    zarovnatZ_min: 'align-z-min', zarovnatZ_stred: 'align-z-center', zarovnatZ_max: 'align-z-max',
    pole: 'array', rozdelitRovinou: 'split-plane', skicaNaPlose: 'sketch-on-face', kapsaNaPlose: 'pocket', vzorDer: 'hole-pattern',
    struktura: 'surface-texture', zavitNaValec: 'thread', textObvod: 'text-around', relief: 'relief', obalSvg: 'wrap-svg', tazeni: 'sweep',
    pivot: 'pivot', otocitKolemBodu: 'rotate-pivot', zaoblitHrany: 'fillet', srazitHrany: 'chamfer', skorepina: 'shell', odsadit: 'offset',
    mereni: 'measure', vule: 'clearance', mojeVule: 'print-calibration', rezPohledu: 'section-view', poznamka: 'note', poznamkySkryt: 'toggle-notes',
    historie: 'history', kontrolaTisku: 'print-check', rozmistit: 'arrange-on-bed', orientace: 'best-orientation', promenne: 'variables',
    sestava: 'assembly', vykres: 'technical-drawing', ulozitTvar: 'save-custom-shape', paleta: 'command-palette',
    zamerit: 'focus-selection', koty: 'dimensions', rychleKoty: 'clearance-check', prevesy: 'overhangs', podpery: 'overhangs',
    obrazek: 'save-image', napoveda: 'help', skladacka: 'puzzle-assembly', magnet: 'magnet', skryteHrany: 'section-view', zameritStred: 'focus-selection', naZakladniDesku: 'place-on-bed', navody: 'help',
    // Soubor (data-soubor) a paleta (souborXxx)
    novyProjekt: 'new-project', souborNovy: 'new-project', sablony: 'new-template', projekty: 'my-projects',
    otevritSoubor: 'open-file', ulozitSoubor: 'save-file', exportovat: 'export',
  };
  /** Další prvky bez příkazu: [selektor, ikona]. */
  const PRVKY = [
    ['[data-nabidka="nabSoubor"]', 'project'], ['#btnTvary', 'add-shape'], ['[data-nabidka="nabUpravy"]', 'tools'],
    ['[data-nabidka="nabDilna"]', 'workshop'], ['[data-nabidka="nabPohled"]', 'orbit-view'], ['#btnDomu', 'home-view'],
    ['#btnNapoveda', 'help'], ['#btnProjekce', 'projection'],
    ['[data-pohled="zepredu"]', 'view-front'], ['[data-pohled="zezadu"]', 'view-back'], ['[data-pohled="zleva"]', 'view-left'],
    ['[data-pohled="zprava"]', 'view-right'], ['[data-pohled="shora"]', 'view-top'], ['[data-pohled="zdola"]', 'view-bottom'],
    ['#tiskPrevesy', 'overhangs'], ['#tiskOrientace', 'best-orientation'], ['#tiskRozmistit', 'arrange-on-bed'],
    ['#mojeExport', 'export-library'], ['#mojeImport', 'import-library'],
    ['[data-akce="skica"]', 'new-sketch'], ['[data-akce="svg"]', 'import-svg'],
    ['#inspSkica', 'new-sketch'], ['#inspOcctUpravit', 'fillet'], ['#nabPohled .nab-nadpis', 'workspace-theme'],
  ];
  M.cestaIkony = jmeno => CESTA + jmeno + '.webp';
  /** HTML obrázku ikony (dekorace – text tlačítka nebo aria-label nese význam). */
  M.htmlIkony = (jmeno, trida = 'ik-cad') => jmeno ? `<img class="${trida}" src="${M.cestaIkony(jmeno)}" alt="" aria-hidden="true" draggable="false">` : '';
  /** Ikona příkazu z palety (id příkazu nebo název), nebo ''. */
  M.ikonaPrikazu = id => M.IKONY[id] || '';

  /** Úvodní symbol v textu (emoji, šipka, ƒx) – ten ikona nahradí. */
  const SYMBOL = /^\s*(?:ƒx|[^\p{L}\p{N}„"(]+)\s*/u;
  function dejIkonu(el, jmeno) {
    if (!el || el.dataset.ikona) return;
    el.dataset.ikona = jmeno;
    // úvodní textový uzel (nebo span.ik u dlaždic)
    const ik = el.querySelector(':scope > .ik');
    if (ik) { ik.innerHTML = M.htmlIkony(jmeno, 'ik-cad ik-dlazdice'); return; }
    const t = el.firstChild;
    if (t && t.nodeType === 3) {
      const m = SYMBOL.exec(t.nodeValue);
      if (m) t.nodeValue = t.nodeValue.slice(m[0].length);
      if (!t.nodeValue && el.childNodes.length === 1 && !el.getAttribute('aria-label')) el.setAttribute('aria-label', el.title || jmeno);
    }
    el.insertAdjacentHTML('afterbegin', M.htmlIkony(jmeno));
    el.classList.add('s-ikonou');
  }

  /** Ikony do tlačítek v dokumentu (koren = jen tahle část – panely stavěné později). */
  M.pouzijIkony = function (koren = document) {
    for (const el of koren.querySelectorAll('[data-prikaz], [data-soubor]')) {
      const id = el.dataset.prikaz || el.dataset.soubor;
      if (M.IKONY[id]) dejIkonu(el, M.IKONY[id]);
    }
    for (const [sel, jmeno] of PRVKY) for (const el of koren.querySelectorAll(sel)) dejIkonu(el, jmeno);
  };
})(MDL);
