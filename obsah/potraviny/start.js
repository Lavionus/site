/* ============================================================
   potraviny/start.js – spouští se v hlavičce před ostatními skripty (CSP nepovoluje vložené skripty).
   Verze kódu je v <meta name="denik-verze"> stránky; aplikace.js ji porovná se svou a s jadro.js.
   ============================================================ */
/* barva stavové lišty podle tématu aplikace (ne podle systému) */
(function () {
  const m = document.querySelector('meta[name="theme-color"]');
  const nastav = () => { m.content = document.documentElement.dataset.theme === 'light' ? '#e8eaed' : '#121212'; };
  nastav();
  new MutationObserver(nastav).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
/* Pojistka: service worker vrací nejdřív soubory z mezipaměti. Když se tam po aktualizaci sejdou soubory
   z různých verzí, aplikace by nenastartovala – pak se nabídne (nebo sama provede) obnova souborů. */
try { const p = localStorage.getItem('webapp_potraviny_pismo'); if (p) document.documentElement.dataset.pismo = p; } catch (e) { /* nic */ }
window.DENIK_VERZE = (document.querySelector('meta[name="denik-verze"]') || {}).content || '';
window.obnovDenik = async function () {
  // bez sítě by smazání uložených souborů aplikaci úplně odstřihlo
  if (!navigator.onLine) { alert('Pro obnovu aplikace je potřeba připojení k internetu.'); return; }
  try {
    for (const k of await caches.keys()) {
      if (k.indexOf('webapp-') !== 0) continue;
      const c = await caches.open(k);
      for (const r of await c.keys()) if (/\/obsah\/(potraviny|lib\/(zxing|tesseract|qrcode|xlsx))/.test(r.url)) await c.delete(r);
    }
  } catch (e) { /* bez Cache API */ }
  try {
    await Promise.all(['potraviny.html', 'potraviny/start.js', 'potraviny/jadro.js', 'potraviny/aplikace.js', 'potraviny/grafy.js', 'potraviny/ctecka.js', 'potraviny/prenos.js', 'potraviny/etiketa.js']
      .map(u => fetch(u, { cache: 'reload' })));
  } catch (e) { /* offline */ }
  location.reload();
};
(function () {
  let selhalo = false;
  const zachran = () => {
    const el = document.getElementById('dataStav');
    if (!el || (window.DENIK && window.DENIK.spusteno !== false && !selhalo)) return;
    if (el.querySelector('button')) return;   // už ukazuje konkrétní chybu s tlačítkem
    el.textContent = 'Aplikace se nespustila – nejspíš se po aktualizaci smíchaly staré a nové soubory. ';
    const b = document.createElement('button');
    b.className = 'btn mini'; b.type = 'button'; b.textContent = '↻ Obnovit aplikaci'; b.onclick = window.obnovDenik;
    el.appendChild(b);
  };
  addEventListener('error', e => {
    if (/\/potraviny\/[a-z]+\.js/.test(e.filename || '') && !(window.DENIK && window.DENIK.spusteno)) { selhalo = true; setTimeout(zachran, 500); }
  });
  setTimeout(zachran, 20000);
})();
