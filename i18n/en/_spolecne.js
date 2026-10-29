// Společné anglické texty: sdílené moduly, které se objeví na kterékoli stránce.
// Rozcestník má vlastní index.js, katalog _katalog.js.
I18N.pridej('en', {
  // podpis.js
  'Webové stránky': 'Web Toolbox',
  'Rozcestník': 'Home',
  'Zpět do rozcestníku aplikací': 'Back to the app overview',

  // stavy stránek (KATALOG_STAVY – štítek v podpisu i v rozcestníku)
  'Vývoj': 'Dev',
  'Ve vývoji – zatím neprošlo kontrolou autora': 'In development – not yet reviewed by the author',
  'Beta': 'Beta',
  'Zkontrolováno autorem, ještě se může měnit': 'Reviewed by the author, may still change',
  'Stable': 'Stable',
  'Hotová, ověřená verze': 'Finished, verified version',

  // dialog.js – výchozí tlačítka
  'Zrušit': 'Cancel',
  'OK': 'OK',

  // rekord.js
  'Nejlepší': 'Best',
  'Nejlepší čas': 'Best time',
  'Vynulovat rekord': 'Reset record',

  // tvary.js – uložená nastavení generátorů
  '💾 Uložené tvary': '💾 Saved shapes',
  'Uložit tvar': 'Save shape',
  'Záloha do souboru': 'Back up to file',
  'Načíst zálohu': 'Load backup',
  'Zatím nic uloženého. Nastavte rozměry a klepněte na „Uložit tvar“ — uloží se do tohoto prohlížeče a půjde kdykoli znovu načíst.':
    'Nothing saved yet. Set the dimensions and click “Save shape” – it is stored in this browser and can be loaded again at any time.',
  'Načíst': 'Load',
  'Přepsat': 'Overwrite',
  'Název': 'Rename',
  'Smazat': 'Delete',
  'Tvar': 'Shape',
  'Název tvaru': 'Shape name',
  'Uložit': 'Save',
  'Nový název': 'New name',
  'Přejmenovat': 'Rename',
  'Nahrát': 'Import',
  'Smazáno': 'Deleted',
  'Tvar se nepodařilo uložit — úložiště prohlížeče je plné nebo zakázané.':
    'The shape could not be saved – browser storage is full or disabled.',
  'Tvar se nepodařilo přečíst: {chyba}': 'The shape could not be read: {chyba}',
  'Tvar se nepodařilo načíst: {chyba}': 'The shape could not be loaded: {chyba}',
  'Tvar „{nazev}“ už existuje. Přepsat ho?': 'Shape “{nazev}” already exists. Overwrite it?',
  'Uloženo jako „{nazev}“': 'Saved as “{nazev}”',
  'Načteno: {nazev}': 'Loaded: {nazev}',
  'Přepsat „{nazev}“ současným nastavením?': 'Overwrite “{nazev}” with the current settings?',
  'Přepsáno: {nazev}': 'Overwritten: {nazev}',
  'Tvar s tímto názvem už existuje.': 'A shape with this name already exists.',
  'Není co zálohovat — zatím nemáte uložený žádný tvar.': 'Nothing to back up – you have no saved shapes yet.',
  'Záloha stažena ({n} tvar)': { one: 'Backup downloaded ({n} shape)', other: 'Backup downloaded ({n} shapes)' },
  'Záloha stažena ({n} tvarů)': { one: 'Backup downloaded ({n} shape)', other: 'Backup downloaded ({n} shapes)' },
  'Soubor není platný JSON.': 'The file is not valid JSON.',
  'V souboru nejsou žádné tvary.': 'The file contains no shapes.',
  'Záloha je z jiného generátoru ({typ}). Nahrát i tak?': 'The backup is from a different generator ({typ}). Import anyway?',
  'V souboru nejsou žádné použitelné tvary.': 'The file contains no usable shapes.',
  'Nahráno {n} tvar': { one: 'Imported {n} shape', other: 'Imported {n} shapes' },
  'Nahráno {n} tvarů': { one: 'Imported {n} shape', other: 'Imported {n} shapes' },
});
