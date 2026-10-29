// Nastavení – data uložená v prohlížeči (obsah/nastaveni.html). Názvy aplikací jsou v _katalog.js.
I18N.pridej('en', {
  '⚙️ Nastavení': '⚙️ Settings',
  'Všechny aplikace tohoto webu si ukládají data jen lokálně v tomto prohlížeči – drobnosti do sdíleného':
    'All apps on this website store their data only locally in this browser – small items in the shared',
  ', větší data (fotky, písma, modely) do databází IndexedDB.': ', larger data (photos, fonts, models) in IndexedDB databases.',
  '💾 Sdílené úložiště (localStorage)': '💾 Shared storage (localStorage)',
  'Filtrovat podle aplikace nebo klíče…': 'Filter by app or key…',
  'Kvóta prohlížeče bývá kolem 5 MB pro celý web dohromady a všechny aplikace ji sdílejí – jedna zaplněná aplikace tak zablokuje ukládání i ostatním. Smazáním položky přijdete o data té aplikace; nejde to vrátit zpět. Kterým aplikacím data patří, se určuje podle seznamu klíčů vytaženého ze zdrojových kódů – položky bez přiřazení jsou nejspíš pozůstatky starších verzí nebo data jiného webu na stejné adrese.':
    'The browser quota is usually about 5 MB for the whole website, shared by all apps – one full app blocks saving for the others too. Deleting an item removes that app’s data; it cannot be undone. Which app the data belongs to is determined from a list of keys extracted from the source code – unassigned items are most likely leftovers of older versions or data of another website at the same address.',
  '🗄️ Větší data (IndexedDB)': '🗄️ Larger data (IndexedDB)',
  'Načítám…': 'Loading…',
  'Databáze nesdílejí pětimegabajtovou kvótu – prohlížeč jim dovolí podstatně víc podle volného místa na disku. Celkové číslo nahoře zahrnuje i offline kopii webu (service worker). Smazáním databáze přijde aplikace o všechna data v ní; nejde to vrátit zpět.':
    'Databases do not share the five-megabyte quota – the browser allows them much more, depending on free disk space. The total above also includes the offline copy of the website (service worker). Deleting a database removes all of the app’s data in it; it cannot be undone.',

  'Zabráno celkem': 'Total used',
  '· {a} aplikací, {p} položek': '· apps: {a}, items: {p}',
  '{n} % z přibližné kvóty 5 MB': '{n} % of the approximate 5 MB quota',
  'Aplikace': 'App',
  'Velikost': 'Size',
  '{n} položek': { one: '{n} item', other: '{n} items' },
  'Jednotlivé položky': 'Individual items',
  'Smazat tuto položku': 'Delete this item',
  'Smazat všechna data této aplikace': 'Delete all data of this app',
  'Nepřiřazená data': 'Unassigned data',
  'Nepřiřazená databáze': 'Unassigned database',
  'Filtru nic neodpovídá.': 'Nothing matches the filter.',
  'Úložiště je prázdné.': 'Storage is empty.',
  'Úložiště prohlížeče není dostupné.': 'Browser storage is not available.',
  '🏠 Rozcestník (menu, téma, oblíbené)': '🏠 Home page (menu, theme, favourites)',
  '🎓 Nodus (výukový web)': '🎓 Nodus (learning website)',
  'Opravdu smazat uložená data „{klic}“? Aplikace, která je používá, o ně nenávratně přijde.':
    'Really delete the stored data “{klic}”? The app that uses it will lose it permanently.',
  'Opravdu smazat všechna data aplikace „{nazev}“ ({n} položka, {kb})? Nejde to vrátit zpět.':
    { one: 'Really delete all data of “{nazev}” ({n} item, {kb})? This cannot be undone.', other: 'Really delete all data of “{nazev}” ({n} items, {kb})? This cannot be undone.' },
  'Opravdu smazat všechna data aplikace „{nazev}“ ({n} položky, {kb})? Nejde to vrátit zpět.':
    'Really delete all data of “{nazev}” ({n} items, {kb})? This cannot be undone.',
  'Opravdu smazat všechna data aplikace „{nazev}“ ({n} položek, {kb})? Nejde to vrátit zpět.':
    'Really delete all data of “{nazev}” ({n} items, {kb})? This cannot be undone.',
  'Opravdu smazat nepřiřazená data „{nazev}“? Nejde to vrátit zpět.': 'Really delete the unassigned data “{nazev}”? This cannot be undone.',

  'Celkem na disku': 'Total on disk',
  'z dostupných {kb}': 'of {kb} available',
  '🔒 trvalé úložiště – prohlížeč data sám nesmaže': '🔒 persistent storage – the browser will not delete the data on its own',
  'při nedostatku místa může prohlížeč data smazat': 'the browser may delete the data when space runs low',
  'Žádná aplikace zatím IndexedDB nepoužila.': 'No app has used IndexedDB yet.',
  'IndexedDB není v tomto prohlížeči dostupná.': 'IndexedDB is not available in this browser.',
  'Tento prohlížeč neumí vypsat seznam databází.': 'This browser cannot list its databases.',
  'Seznam databází se nepodařilo načíst.': 'The list of databases could not be loaded.',
  'Smazat databázi': 'Delete database',
  '{n} záznamů': { one: '{n} record', other: '{n} records' },
  'Opravdu smazat všechna data aplikace „{nazev}“ v databázi {db}? Nejde to vrátit zpět.':
    'Really delete all data of “{nazev}” in database {db}? This cannot be undone.',
  'Opravdu smazat všechna data aplikace „{nazev}“ v databázi {db} (≈ {kb})? Nejde to vrátit zpět.':
    'Really delete all data of “{nazev}” in database {db} (≈ {kb})? This cannot be undone.',
  'Opravdu smazat nepřiřazenou databázi „{db}“? Nejde to vrátit zpět.': 'Really delete the unassigned database “{db}”? This cannot be undone.',
  'Opravdu smazat nepřiřazenou databázi „{db}“ (≈ {kb})? Nejde to vrátit zpět.': 'Really delete the unassigned database “{db}” (≈ {kb})? This cannot be undone.',
  'Databázi používá aplikace otevřená v jiné záložce – smaže se, až ji zavřete.':
    'The database is used by an app open in another tab – it will be deleted once you close it.',
});
