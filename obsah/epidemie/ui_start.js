/* ============================================================
   epidemie/ui_start.js – spuštění stránky (načte se poslední, po všech záložkách).
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp;
  App.naplnFormular();
  App.odvozene();
  App.kresliOsu();
  App.editorOsy();
  if (App.zOdkazu) Dialog.info('Parametry načteny z odkazu.');
  App.prepni(App.cti('zalozka2') || 'model');
  // pro testy v prohlížeči
  window.EpiUI = App;
})();
