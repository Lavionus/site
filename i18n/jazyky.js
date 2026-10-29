// Rejstřík jazyků – jediné místo, kde jazyk „vzniká“. Nový jazyk = záznam
// sem + složka i18n/<kod>/ se slovníky; i18n.js ani stránky se nemění.
//   kod       – kód jazyka (shodný se složkou slovníků)
//   locale    – pro Intl (čísla, data, množné číslo); výchozí = kod
//   zaloha    – kde hledat chybějící překlad, než se ukáže čeština
//   pribuzne  – jazyky prohlížeče, které dostanou tenhle jazyk (sk → cs)
//   nahradni  – jazyk pro návštěvníky, jejichž jazyk web nemá
//   stav      – 'vyvoj' / 'beta' / 'stable' jako u stránek; 'test' = jen ručně přes ?lang=
//   pseudo    – testovací jazyk: místo slovníku ⟦text···⟧, odhalí nepřeložené a přetékající texty
I18N.rejstrik([
  { kod: 'cs', nazev: 'Čeština', cesky: 'čeština',   smer: 'ltr', locale: 'cs-CZ', zaloha: [],     pribuzne: ['sk'], stav: 'stable' },
  { kod: 'en', nazev: 'English', cesky: 'angličtina', smer: 'ltr', locale: 'en-GB', zaloha: ['cs'], nahradni: true,   stav: 'vyvoj' },
  { kod: 'xx', nazev: 'Pseudo',  cesky: 'pseudojazyk', smer: 'ltr', locale: 'en-GB', zaloha: ['cs'], pseudo: true,     stav: 'test' },
]);
