/* casova_osa/srovnani.js – připravená srovnání (výběr stop + výřez osy).
   Data jsou v datovém zápisu jádra (záporný rok = př. n. l.). */
(function (g) {
  const SROVNANI = [
    { id: 'prehled', nazev: 'Od pyramid po dnešek', popis: 'Egypt, Řím, Čína, Evropa a České země na jedné ose.',
      stopy: ['egypt', 'rim', 'cina', 'evropa', 'ceske_zeme', 'veda'], od: '-3500', do: '2030' },
    { id: 'staroveke', nazev: 'Starověké civilizace', popis: 'Mezopotámie, Egypt, Persie, Řecko, Řím, Indie a Čína souběžně.',
      stopy: ['mezopotamie', 'egypt', 'persie', 'recko', 'rim', 'indie', 'cina'], od: '-3600', do: '700' },
    { id: 'osova', nazev: 'Osová doba', popis: 'Buddha, Konfucius a řečtí filozofové žili ve stejných staletích.',
      stopy: ['recko', 'persie', 'indie', 'cina', 'rim'], od: '-900', do: '-150' },
    { id: 'rim_cina', nazev: 'Řím a Čína', popis: 'Dvě říše na opačných koncích Hedvábné stezky.',
      stopy: ['rim', 'cina', 'persie', 'indie'], od: '-300', do: '650' },
    { id: 'stredovek', nazev: 'Středověk: Evropa, Byzanc a islám', popis: 'Křesťanský západ, Konstantinopol a chalífáty vedle Čech.',
      stopy: ['evropa', 'ceske_zeme', 'byzanc', 'islam'], od: '450', do: '1550' },
    { id: 'karel4', nazev: 'Svět Karla IV.', popis: 'Co se dělo jinde ve světě za vlády Karla IV. (1346–1378).',
      stopy: ['ceske_zeme', 'evropa', 'byzanc', 'islam', 'cina', 'japonsko', 'mezoamerika'], od: '1300', do: '1420' },
    { id: 'objevy', nazev: 'Objevné plavby a Nový svět', popis: 'Konec Byzance, Kolumbus, pád Aztéků a Inků.',
      stopy: ['evropa', 'amerika', 'mezoamerika', 'byzanc', 'ceske_zeme'], od: '1400', do: '1650' },
    { id: 'asie', nazev: 'Asie v dlouhém trvání', popis: 'Čínské dynastie, Japonsko, Indie a islámský svět.',
      stopy: ['cina', 'japonsko', 'indie', 'islam'], od: '-600', do: '1950' },
    { id: 'revoluce', nazev: 'Osvícenství a revoluce', popis: 'Americká a francouzská revoluce, věda a umění 18. století.',
      stopy: ['evropa', 'amerika', 'veda', 'osobnosti', 'ceske_zeme'], od: '1680', do: '1870' },
    { id: 'velka_valka', nazev: '1. světová válka den po dni', popis: 'Od Sarajeva po příměří – přiblížení na měsíce a dny.',
      stopy: ['svetove_valky', 'ceske_zeme', 'evropa'], od: '1914-06', do: '1918-12' },
    { id: 'druha_valka', nazev: '2. světová válka', popis: 'Od Mnichova po kapitulaci Japonska.',
      stopy: ['svetove_valky', 'ceske_zeme', 'amerika'], od: '1938-08', do: '1945-10' },
    { id: 'studena', nazev: 'Studená válka a závod o vesmír', popis: 'Politika a kosmonautika 1945–1991 vedle sebe.',
      stopy: ['studena_valka', 'vesmir', 'ceske_zeme', 'amerika'], od: '1944', do: '1993' },
    { id: 'kuba', nazev: 'Kubánská krize – 13 dní', popis: 'Říjen 1962 den po dni.',
      stopy: ['studena_valka', 'vesmir'], od: '1962-10-12', do: '1962-11-02' },
    { id: 'apollo', nazev: 'Apollo 11 – cesta na Měsíc', popis: 'Start, přistání, první krok a návrat; přibližte až na minuty (UTC).',
      stopy: ['vesmir', 'studena_valka'], od: '1969-07-15', do: '1969-07-26' },
    { id: 'veda_umeni', nazev: 'Věda a umění', popis: 'Vědecké objevy a životy umělců od knihtisku.',
      stopy: ['veda', 'osobnosti', 'evropa'], od: '1440', do: '2000' },
  ];
  g.CASOVA_OSA_SROVNANI = SROVNANI;
  if (typeof module !== 'undefined') module.exports = SROVNANI;
})(typeof window !== 'undefined' ? window : globalThis);
