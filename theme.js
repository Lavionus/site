/* ============================================================
   theme.js – sdílené přepínání světlého/tmavého tématu.
   Vkládá se do <head> podstránek (před jejich vlastní <style>),
   aby se téma použilo ještě před vykreslením.

   Volbu ukládá rozcestník do localStorage['webapp_theme'].
   Do iframu se změna doručí přes postMessage — událost `storage`
   se ve stejné záložce nespouští, takže by přepnutí uvnitř
   rozcestníku podstránku nikdy nezasáhlo.
   ============================================================ */
(function () {
  // <meta name="color-scheme"> platí hned od prvního vykreslení – prohlížeč tak před
  // načtením CSS nemaluje bílé plátno (záblesk při otevírání stránky v noci)
  let meta = null;
  function pouzij(tema) {
    if (tema === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'color-scheme';
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.content = tema === 'light' ? 'light' : 'dark';
  }

  // přes file:// nebo při zablokovaném úložišti getItem vyhodí výjimku
  try { pouzij(localStorage.getItem('webapp_theme')); }
  catch { pouzij(null); }

  // jiná záložka nebo samostatně otevřené okno
  window.addEventListener('storage', e => {
    if (e.key === 'webapp_theme') pouzij(e.newValue);
  });

  // rozcestník ve stejné záložce (iframe)
  window.addEventListener('message', e => {
    if (e.data && typeof e.data.tema === 'string') pouzij(e.data.tema);
  });
})();

// Překlad do dalších jazyků (i18n.js) musí běžet synchronně v <head> – theme.js
// tam je skoro na všech stránkách, takže se připíše odsud a stránky se nemění.
if (document.readyState === 'loading' && !window.I18N) {
  document.write('<script src="' + new URL('i18n.js', document.currentScript.src).href + '"><\/script>');
}
