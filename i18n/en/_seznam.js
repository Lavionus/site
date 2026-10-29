// Které stránky mají slovník tohoto jazyka i18n/<kod>/<klíč>.js (klíč = cesta pod obsah/ bez .html)
// a které sdílené slovníky potřebují navíc. Doplňuje _test/i18n_vytahni.py – ručně jen výjimečně.
I18N.seznam('en', [
  'about',
  'aplikace',
  'cviceni/index',
  'had',
  'index',
  'nastaveni',
  'pomodoro',
  'stencil',
  'unit_converter',
], {
  _katalog: ['index', 'aplikace', 'about', 'nastaveni'],
  'fonty/fonty': ['hieroglyfy', 'klicenky', 'kostky3d', 'krabicka_pant', 'modelar', 'pismolijna', 'plakat_mapy', 'povrch3d', 'prevod_pisma', 'razitko', 'stencil', 'text3d'],
  'stencil/vystup': ['halloween', 'krajky', 'stencil'],
});
