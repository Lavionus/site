/* Seznam videí pro obsah/nahnoji.html (videotéka Nahnoji.cz).

   Každá položka:
     id      – číslo videa z odkazu http://nahnoji.cz/video?id=21400&s=wide (povinné)
     nazev   – název, který se zobrazí na kartě (povinné)
     datum   – den nahrání RRRR-MM-DD (nepovinné, řadí se podle něj)
     stitky  – pole štítků pro filtrování (nepovinné)
     popis   – krátký text pod názvem (nepovinné)
     serial  – název seriálu; seriál dostane vlastní položku v menu (nepovinné)
     rada    – číslo řady (série) v seriálu (nepovinné, výchozí 1)
     dil     – číslo dílu v řadě (nepovinné)

   NAHNOJI_SERIALY může k seriálu doplnit popis a pořadí v menu.

   Položky jde vygenerovat přímo na stránce: „Přidat videa“ → vložit obsah
   nahnoji_odkazy.tsv z nahrávače → „Kopírovat jako nahnoji_videa.js“. */
window.NAHNOJI_SERIALY = {
  'Král džungle': { ikona: '🦍', popis: 'Animovaný seriál o Georgovi, pánovi džungle (George of the Jungle).' },
};

window.NAHNOJI_VIDEA = [
  { id: 21527, nazev: 'Útok broučka', serial: 'Král džungle', rada: 1, dil: 1 },
  { id: 21528, nazev: 'Nahý lidoop', serial: 'Král džungle', rada: 1, dil: 2 },
  { id: 21529, nazev: 'Aromagedon', serial: 'Král džungle', rada: 1, dil: 3 },
  { id: 21530, nazev: 'Nalezený zlatý chrám', serial: 'Král džungle', rada: 1, dil: 4 },
  { id: 21531, nazev: 'Hlava v kornoutu', serial: 'Král džungle', rada: 1, dil: 5 },
  { id: 21532, nazev: 'Bratranec Larry', serial: 'Král džungle', rada: 1, dil: 6 },
  { id: 21533, nazev: 'Licence na houpání', serial: 'Král džungle', rada: 2, dil: 1 },
  { id: 21534, nazev: 'Můj vlastní hrdina', serial: 'Král džungle', rada: 2, dil: 2 },
  { id: 21535, nazev: 'Chrápání', serial: 'Král džungle', rada: 2, dil: 3 },
  { id: 21536, nazev: 'Georgův volný den', serial: 'Král džungle', rada: 2, dil: 4 },
  { id: 21537, nazev: 'Šťastné kalhoty', serial: 'Král džungle', rada: 2, dil: 5 },
  { id: 21538, nazev: 'Opice Ruth', serial: 'Král džungle', rada: 2, dil: 6 },
  { id: 21539, nazev: 'Neděkujte mi', serial: 'Král džungle', rada: 3, dil: 1 },
  { id: 21540, nazev: 'Kamarád lenochod', serial: 'Král džungle', rada: 3, dil: 2 },
  { id: 21541, nazev: 'Zakletá kůlna', serial: 'Král džungle', rada: 3, dil: 3 },
  { id: 21542, nazev: 'Posedlost módou', serial: 'Král džungle', rada: 3, dil: 4 },
  { id: 21543, nazev: 'Něco si přej', serial: 'Král džungle', rada: 3, dil: 5 },
  { id: 21544, nazev: 'Opuštěný mravenečník', serial: 'Král džungle', rada: 3, dil: 6 },
  { id: 21545, nazev: 'Bratr George', serial: 'Král džungle', rada: 4, dil: 1 },
  { id: 21546, nazev: 'Opičí mitzvah', serial: 'Král džungle', rada: 4, dil: 2 },
  { id: 21547, nazev: 'Frankengeorge', serial: 'Král džungle', rada: 4, dil: 3 },
  { id: 21558, nazev: 'Strach z ničeho', serial: 'Král džungle', rada: 4, dil: 4 },
  { id: 21559, nazev: 'Vegemistr', serial: 'Král džungle', rada: 4, dil: 5 },
  { id: 21560, nazev: 'Orlí klíště', serial: 'Král džungle', rada: 4, dil: 6 },
  { id: 21561, nazev: 'Sobecká mušle', serial: 'Král džungle', rada: 5, dil: 1 },
  { id: 21562, nazev: 'Vulkánova show', serial: 'Král džungle', rada: 5, dil: 2 },
  { id: 21549, nazev: 'Hustí pitomci', serial: 'Král džungle', rada: 5, dil: 3 },
  { id: 21550, nazev: 'Pořád na to mám', serial: 'Král džungle', rada: 5, dil: 4 },
  { id: 21551, nazev: 'Trable s banáníky', serial: 'Král džungle', rada: 5, dil: 5 },
  { id: 21563, nazev: 'Rozmazlený král', serial: 'Král džungle', rada: 5, dil: 6 },
];
